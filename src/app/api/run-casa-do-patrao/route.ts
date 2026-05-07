import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { resolveBbbHostingPublicDir } from '@/lib/internalJobsRuntimePaths';
import { writeHostingPublicMainAndLatest } from '@/lib/hostingPublicJsonWrite';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MAIN_BASENAME = 'casa-do-patrao-participantes.json';
const SOURCE_RELATIVE_PATH = join('data', 'casa-do-patrao-participantes.json');

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
  const effectiveKey = (expectedApiKey && expectedApiKey.trim().length > 0) ? expectedApiKey : fallback;
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
    const status =
      message === 'Acesso negado' ? 401
      : message.startsWith('Configuração ausente') ? 500
      : 500;
    return NextResponse.json({ error: message }, { status });
  }

  const stream = new ReadableStream({
    start(controller) {
      activeStreams.add(controller);

      if (running) {
        controller.enqueue('data: ❌ Casa do Patrão já está em execução. Aguarde a conclusão.\n\n');
        controller.enqueue('event: status\ndata: error\n\n');
        controller.close();
        activeStreams.delete(controller);
        return;
      }

      running = true;

      executeCasaDoPatraoStreaming()
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
      // Se o cliente desconectar, encerramos o processo filho para não deixar
      // um job "órfão" rodando sem UI (e sem lock consistente).
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
    if (!isAlive()) {
      return;
    }

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
  })()
    .finally(() => {
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
  // Só deve rodar quando o ciclo (processo + publicação) terminou
  // ou em fallback quando o processo finalizou mas `close` não veio.
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

async function executeCasaDoPatraoStreaming(): Promise<void> {
  const rootDir = process.cwd();
  const sourcePath = join(rootDir, SOURCE_RELATIVE_PATH);

  return new Promise((resolve, reject) => {
    broadcast(`🚀 Iniciando Casa do Patrão...`);
    broadcast(`📅 ${new Date().toLocaleString('pt-BR')}`);
    broadcast(`📂 CWD: ${rootDir}`);
    broadcast(`▶️ Comando: npm run scrape:casa-patrao`);

    const child = spawn('npm', ['run', 'scrape:casa-patrao'], {
      cwd: rootDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, NODE_ENV: 'production' },
    });
    activeChild = child;
    childCleaned = false;
    closeHandled = false;
    if (exitFallbackTimer) {
      clearTimeout(exitFallbackTimer);
      exitFallbackTimer = null;
    }

    child.once('exit', (code, signal) => {
      // Não libera o lock aqui: a etapa de publicação acontece no `close`.
      // Fallback: se `close` não chegar após um pequeno prazo, limpamos o lock
      // sem publicar/emitir success (evita janela de concorrência e evita duplicação).
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
          `[casa do patrão] Não foi possível iniciar npm (cwd=${rootDir}): ${error.message}. Confira se node e npm estão no PATH.`,
        ),
      );
    });

    const timeoutMs = parseInt(process.env.CASA_DO_PATRAO_TIMEOUT_MS || '600000', 10); // 10min
    const timeout = setTimeout(() => {
      void terminateActiveChild('timeout').finally(() => {
        reject(new Error(`[casa do patrão] Timeout após ${Math.round(timeoutMs / 1000 / 60)} minutos`));
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
          resolve();
          return;
        }

        broadcast(`✅ Script concluído com sucesso`);
        broadcast(`📄 Lendo saída: ${SOURCE_RELATIVE_PATH}`);

        if (!existsSync(sourcePath)) {
          throw new Error(`Arquivo não encontrado após execução: ${sourcePath}`);
        }

        const raw = readFileSync(sourcePath, 'utf8');
        let data: unknown;
        try {
          data = JSON.parse(raw) as unknown;
        } catch {
          throw new Error(`JSON inválido em ${SOURCE_RELATIVE_PATH}`);
        }

        const count = Array.isArray(data) ? data.length : undefined;
        if (typeof count === 'number') {
          broadcast(`🔢 Participantes: ${count}`);
        }

        const publicDir = resolveBbbHostingPublicDir();
        broadcast(`📤 Publicando em: ${publicDir}/${MAIN_BASENAME}`);

        writeHostingPublicMainAndLatest(publicDir, MAIN_BASENAME, data);

        broadcast(`🎯 Preview: /api/hosting-public/${MAIN_BASENAME}`);
        broadcast(`🎯 Latest: /api/hosting-public/${MAIN_BASENAME.replace(/\\.json$/i, '-latest.json')}`);

        broadcastStatus('success');
        cleanupChild(`close success code=${code ?? 'null'}`, child);
        setTimeout(() => finishStreaming(), 2000);
        resolve();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        broadcast(`❌ Erro ao finalizar/publicar: ${msg}`);
        broadcastStatus('error');
        cleanupChild(`close exception code=${code ?? 'null'}`, child);
        setTimeout(() => finishStreaming(), 2000);
        reject(err);
      }
    });
  });
}

