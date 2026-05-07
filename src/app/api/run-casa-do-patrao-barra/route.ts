import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { resolveBbbHostingPublicDir } from '@/lib/internalJobsRuntimePaths';
import { writeHostingPublicMainAndLatest } from '@/lib/hostingPublicJsonWrite';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MAIN_BASENAME = 'casa-do-patrao-participantes-barra.json';
const SOURCE_RELATIVE_PATH = join('data', 'casa-do-patrao-participantes-barra.json');

let running = false;
const activeStreams = new Set<ReadableStreamDefaultController>();
let activeChild: ReturnType<typeof spawn> | null = null;
let terminating = false;
let terminatePromise: Promise<void> | null = null;
let childCleaned = false;
let closeHandled = false;
let exitFallbackTimer: ReturnType<typeof setTimeout> | null = null;

function assertAdmin(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key');
  const expectedApiKey = process.env.ADMIN_API_KEY;
  if (process.env.NODE_ENV === 'production' && (!expectedApiKey || expectedApiKey.trim().length === 0)) {
    throw new Error('Configuração ausente: defina ADMIN_API_KEY em produção.');
  }
  const fallback = 'admin-bbb26-dev-key';
  const effectiveKey = expectedApiKey && expectedApiKey.trim().length > 0 ? expectedApiKey : fallback;
  if (!apiKey || apiKey !== effectiveKey) {
    throw new Error('Acesso negado');
  }
}

function broadcast(data: string) {
  activeStreams.forEach((controller) => {
    try {
      controller.enqueue(`data: ${data}\n\n`);
    } catch {
      activeStreams.delete(controller);
    }
  });
}

function broadcastStatus(status: 'success' | 'error') {
  activeStreams.forEach((controller) => {
    try {
      controller.enqueue(`event: status\ndata: ${status}\n\n`);
      controller.enqueue(`data: ${status}\n\n`);
    } catch {
      activeStreams.delete(controller);
    }
  });
}

export async function GET(request: NextRequest) {
  try {
    assertAdmin(request);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    const status = message === 'Acesso negado' ? 401 : message.startsWith('Configuração ausente') ? 500 : 500;
    return NextResponse.json({ error: message }, { status });
  }

  const stream = new ReadableStream({
    start(controller) {
      activeStreams.add(controller);

      if (running) {
        controller.enqueue('data: ❌ Casa do Patrão (barra) já está em execução. Aguarde a conclusão.\n\n');
        controller.enqueue('event: status\ndata: error\n\n');
        controller.close();
        activeStreams.delete(controller);
        return;
      }

      running = true;

      executeCasaDoPatraoBarraStreaming()
        .then(() => {
          // noop
        })
        .catch((error) => {
          const msg = error instanceof Error ? error.message : String(error);
          broadcast(`❌ Erro: ${msg}`);
          broadcastStatus('error');
          setTimeout(() => finishStreaming(), 500);
        });
    },
    cancel() {
      void terminateActiveChild('client-cancel').finally(() => finishStreaming());
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

async function terminateActiveChild(reason: string): Promise<void> {
  if (!activeChild) return;
  if (terminating && terminatePromise) return terminatePromise;

  terminating = true;
  terminatePromise = (async () => {
    const child = activeChild;
    const isAlive = () => child.exitCode === null && !child.killed;
    if (!isAlive()) return;

    try {
      broadcast(`🛑 Encerrando processo (motivo: ${reason})...`);
      child.kill('SIGTERM');
    } catch {
      // ignore
    }

    const waitMs = 3000;
    await new Promise<void>((resolve) => setTimeout(resolve, waitMs));

    if (isAlive()) {
      try {
        broadcast(`🛑 Processo ainda ativo após ${Math.round(waitMs / 1000)}s, forçando SIGKILL...`);
        child.kill('SIGKILL');
      } catch {
        // ignore
      }
    }
  })().finally(() => {
    terminating = false;
    terminatePromise = null;
  });

  return terminatePromise;
}

function cleanupChild(reason: string, child?: ReturnType<typeof spawn> | null) {
  const target = child ?? activeChild;
  if (!target) return;
  if (childCleaned) return;
  if (activeChild && target !== activeChild) return;
  childCleaned = true;
  activeChild = null;
  running = false;
  broadcast(`🧹 Cleanup do processo finalizado (${reason})`);
}

function finishStreaming() {
  activeStreams.forEach((controller) => {
    try {
      controller.close();
    } catch {
      // already closed
    }
  });
  activeStreams.clear();
}

async function executeCasaDoPatraoBarraStreaming(): Promise<void> {
  const rootDir = process.cwd();
  const sourcePath = join(rootDir, SOURCE_RELATIVE_PATH);

  return new Promise((resolve, reject) => {
    broadcast(`🚀 Iniciando Casa do Patrão (barra/status)...`);
    broadcast(`📅 ${new Date().toLocaleString('pt-BR')}`);
    broadcast(`📂 CWD: ${rootDir}`);
    broadcast(`▶️ Comando: npm run scrape:casa-patrao-barra`);

    const barraUrl = process.env.CASA_DO_PATRAO_BARRA_URL || 'https://record.r7.com/casa-do-patrao/';
    broadcast(`🌐 URL: ${barraUrl}`);

    const child = spawn('npm', ['run', 'scrape:casa-patrao-barra'], {
      cwd: rootDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        NODE_ENV: 'production',
        CASA_DO_PATRAO_URL: process.env.CASA_DO_PATRAO_URL || barraUrl,
      },
    });

    activeChild = child;
    childCleaned = false;
    closeHandled = false;
    if (exitFallbackTimer) {
      clearTimeout(exitFallbackTimer);
      exitFallbackTimer = null;
    }

    child.once('exit', (code, signal) => {
      exitFallbackTimer = setTimeout(() => {
        if (closeHandled) return;
        if (childCleaned) return;
        broadcast(
          `⚠️ Fallback: "close" não chegou após exit (code=${code ?? 'null'} signal=${signal ?? 'null'}). Liberando lock sem publicar.`,
        );
        cleanupChild(`exit-fallback code=${code ?? 'null'} signal=${signal ?? 'null'}`, child);
        setTimeout(() => finishStreaming(), 500);
      }, 2000);
    });

    child.stdout.on('data', (data: Buffer) => {
      const lines = data
        .toString()
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      for (const line of lines) {
        broadcast(`📝 ${line}`);
      }
    });

    child.stderr.on('data', (data: Buffer) => {
      const lines = data
        .toString()
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      for (const line of lines) {
        broadcast(`⚠️ ${line}`);
      }
    });

    child.on('error', (error) => {
      reject(
        new Error(
          `[casa do patrão barra] Não foi possível iniciar npm (cwd=${rootDir}): ${error.message}. Confira se node e npm estão no PATH.`,
        ),
      );
    });

    const timeoutMs = parseInt(process.env.CASA_DO_PATRAO_TIMEOUT_MS || '600000', 10);
    const timeout = setTimeout(() => {
      void terminateActiveChild('timeout').finally(() => {
        reject(new Error(`[casa do patrão barra] Timeout após ${Math.round(timeoutMs / 1000 / 60)} minutos`));
      });
    }, timeoutMs);

    child.once('close', async (code) => {
      clearTimeout(timeout);
      closeHandled = true;
      if (exitFallbackTimer) {
        clearTimeout(exitFallbackTimer);
        exitFallbackTimer = null;
      }

      try {
        if (code !== 0) {
          broadcast(`❌ Script falhou (código: ${code})`);
          broadcastStatus('error');
          cleanupChild(`close error code=${code ?? 'null'}`, child);
          setTimeout(() => finishStreaming(), 2000);
          reject(new Error(`Script falhou com código ${code}`));
          return;
        }

        if (!existsSync(sourcePath)) {
          broadcast(`❌ Arquivo não encontrado após execução: ${sourcePath}`);
          broadcastStatus('error');
          cleanupChild('missing-source', child);
          setTimeout(() => finishStreaming(), 2000);
          reject(new Error(`Arquivo não encontrado: ${sourcePath}`));
          return;
        }

        const raw = readFileSync(sourcePath, 'utf8');
        const json = JSON.parse(raw) as unknown;

        const publicDir = resolveBbbHostingPublicDir();
        const publish = writeHostingPublicMainAndLatest(publicDir, MAIN_BASENAME, json);
        broadcast(`✅ Publicado: ${MAIN_BASENAME} (${publish.bytes} bytes)`);
        broadcastStatus('success');
        cleanupChild(`close success code=${code ?? 'null'}`, child);
        setTimeout(() => finishStreaming(), 500);
        resolve();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        broadcast(`❌ Erro ao publicar JSON: ${msg}`);
        broadcastStatus('error');
        cleanupChild('publish-error', child);
        setTimeout(() => finishStreaming(), 2000);
        reject(e instanceof Error ? e : new Error(msg));
      }
    });
  });
}

