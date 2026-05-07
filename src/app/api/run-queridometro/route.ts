import { type NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { writeFileSync, readFileSync, readdirSync, statSync, existsSync, renameSync } from 'fs';
import { join } from 'path';
import {
  assertQueridometroRunnable,
  resolveBbbHostingPublicDir,
  resolveQueridometroJobDir,
} from '@/lib/internalJobsRuntimePaths';
import {
  diagnoseQueridometroExport,
  logExportDiagnosis,
} from '@/lib/publishExportDiagnostics';

let running = false;
const activeStreams = new Set<ReadableStreamDefaultController>();

function broadcast(data: string) {
  activeStreams.forEach(controller => {
    try {
      controller.enqueue(`data: ${data}\n\n`);
    } catch (error) {
      activeStreams.delete(controller);
    }
  });
}

export async function POST(request: NextRequest) {
  if (running) {
    return NextResponse.json(
      { error: 'Queridômetro já está em execução' },
      { status: 409 }
    );
  }

  running = true;

  try {
    const jobDir = resolveQueridometroJobDir();
    assertQueridometroRunnable(jobDir);

    const executionResult = await executeQueridometro();
    const copyResult = await copyLatestResult();

    running = false;

    return NextResponse.json({
      ok: true,
      execution: {
        startedAt: executionResult.startedAt,
        finishedAt: new Date().toISOString(),
        publishedPath: copyResult.publishedPath,
        sourcePath: copyResult.sourcePath,
        bytes: copyResult.bytes,
        logTail: executionResult.logTail
      }
    });

  } catch (error) {
    running = false;

    console.error('[run-queridometro]', error);
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString()
    }, { status: 500 });
  }
}

type QueridometroJsonState = {
  ok: boolean;
  mode: 'json';
  running: boolean;
  /** Eco do query param `afterLine` (polling incremental; linhas ainda não bufferizadas no servidor). */
  afterLine: number;
  nextLine: number;
  lines: string[];
  generatedAt: string;
  jobDir?: string;
  latestPublished: Record<string, unknown> | null;
  error?: string;
};

function buildQueridometroJsonState(afterLine: number): QueridometroJsonState {
  const generatedAt = new Date().toISOString();
  const safeAfter = Number.isFinite(afterLine) && afterLine >= 0 ? Math.floor(afterLine) : 0;

  try {
    const jobDir = resolveQueridometroJobDir();
    const publicDir = resolveBbbHostingPublicDir();
    const latestPath = join(publicDir, 'queridometro-latest.json');
    let latestPublished: Record<string, unknown> | null = null;
    if (existsSync(latestPath)) {
      latestPublished = JSON.parse(readFileSync(latestPath, 'utf8')) as Record<string, unknown>;
    }

    return {
      ok: true,
      mode: 'json',
      running,
      afterLine: safeAfter,
      nextLine: safeAfter,
      lines: [],
      generatedAt,
      jobDir,
      latestPublished,
    };
  } catch (e) {
    return {
      ok: false,
      mode: 'json',
      running,
      afterLine: safeAfter,
      nextLine: safeAfter,
      lines: [],
      generatedAt,
      latestPublished: null,
      error: e instanceof Error ? e.message : 'Erro ao montar estado',
    };
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  if (searchParams.get('mode') === 'json') {
    const raw = searchParams.get('afterLine');
    const afterLine =
      raw !== null && raw !== '' ? parseInt(raw, 10) : 0;
    const body = buildQueridometroJsonState(afterLine);
    return NextResponse.json(body, {
      status: body.ok ? 200 : 500,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  }

  const stream = new ReadableStream({
    start(controller) {
      activeStreams.add(controller);

      if (running) {
        broadcast("❌ Queridômetro já está em execução. Aguarde a conclusão.");
        activeStreams.forEach(ctrl => {
          try {
            ctrl.close();
          } catch (error) {
            // Já pode estar fechado
          }
        });
        activeStreams.clear();
        return;
      }

      running = true;

      executeQueridometroStreaming().catch(error => {
        console.error('[run-queridometro] Erro no streaming:', error);
        broadcast(`❌ Erro: ${error instanceof Error ? error.message : String(error)}`);
        broadcast(`event: status\ndata: error\n\n`);

        setTimeout(() => {
          finishStreaming();
        }, 500);
      });
    },
    cancel() {
      activeStreams.forEach(ctrl => {
        try {
          ctrl.close();
        } catch (error) {
          // Já pode estar fechado
        }
      });
      activeStreams.clear();
      running = false;
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

async function executeQueridometro(): Promise<{ logTail: string[]; startedAt: string }> {
  const jobDir = resolveQueridometroJobDir();
  assertQueridometroRunnable(jobDir);

  return new Promise((resolve, reject) => {
    const logs: string[] = [];
    const startedAt = new Date().toISOString();

    const child = spawn('bash', ['run-queridometro.sh'], {
      cwd: jobDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, NODE_ENV: 'production' }
    });

    child.stdout.on('data', (data) => {
      const output = data.toString().trim();
      if (output) {
        logs.push(`[STDOUT] ${output}`);
      }
    });

    child.stderr.on('data', (data) => {
      const output = data.toString().trim();
      if (output) {
        logs.push(`[STDERR] ${output}`);
      }
    });

    child.on('close', (code) => {
      if (code === 0) {
        const logTail = logs.slice(-10);
        resolve({ logTail, startedAt });
      } else {
        reject(
          new Error(
            `[queridômetro] run-queridometro.sh encerrou com código ${code} (cwd=${jobDir}). Últimos logs:\n${logs.slice(-15).join('\n')}`
          )
        );
      }
    });

    child.on('error', (error) => {
      reject(
        new Error(
          `[queridômetro] Não foi possível iniciar bash/run-queridometro.sh (cwd=${jobDir}): ${error.message}. Confira se bash está instalado e no PATH.`
        )
      );
    });

    const timeoutMs = parseInt(process.env.QUERIDOMETRO_TIMEOUT_MS || '900000');
    setTimeout(() => {
      child.kill();
      reject(new Error(`[queridômetro] Timeout após ${timeoutMs / 1000 / 60} minutos (cwd=${jobDir})`));
    }, timeoutMs);
  });
}

async function executeQueridometroStreaming(): Promise<void> {
  let jobDir: string;
  try {
    jobDir = resolveQueridometroJobDir();
    assertQueridometroRunnable(jobDir);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    broadcast(`❌ ${msg}`);
    broadcast(`event: status\ndata: error\n\n`);
    finishStreaming();
    throw err;
  }

  return new Promise((resolve, reject) => {
    broadcast(`🚀 Iniciando queridômetro...`);
    broadcast(`📅 ${new Date().toLocaleString('pt-BR')}`);
    broadcast(`📂 Diretório: ${jobDir}`);

    const child = spawn('bash', ['run-queridometro.sh'], {
      cwd: jobDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, NODE_ENV: 'production' }
    });

    let hasStarted = false;

    child.stdout.on('data', (data) => {
      const lines = data.toString().split('\n').filter((line: string) => line.trim());
      lines.forEach((line: string) => {
        if (!hasStarted && line.includes('Starting') || line.includes('Iniciando') || line.includes('Running')) {
          hasStarted = true;
          broadcast(`✅ Script iniciado`);
        }
        broadcast(`📝 ${line}`);
      });
    });

    child.stderr.on('data', (data) => {
      const lines = data.toString().split('\n').filter((line: string) => line.trim());
      lines.forEach((line: string) => {
        broadcast(`⚠️ ${line}`);
      });
    });

    child.on('close', async (code) => {
      try {
        if (code === 0) {
          broadcast(`✅ Script concluído com sucesso`);

          broadcast(`📋 Copiando resultado...`);
          const copyResult = await copyLatestResult();
          broadcast(`📄 Arquivo principal atualizado: queridometro.json`);
          broadcast(`📅 Arquivo datado salvo: ${copyResult.bytes} bytes`);
          broadcast(`🎯 Resultado disponível em: ${copyResult.publishedPath}`);

          broadcast(`✨ Queridômetro finalizado!`);

          console.log('[run-queridometro] Enviando evento status: success');
          broadcast(`event: status\ndata: success\n\n`);
          broadcast(`success`);

          setTimeout(() => {
            console.log('[run-queridometro] Fechando streams SSE após sucesso');
            finishStreaming();
          }, 2000);

        } else {
          broadcast(`❌ Script falhou (código: ${code})`);
          broadcast(
            `💡 Dica: verifique logs acima, dependências em internal-jobs/queridometro (npm ci) e Playwright. cwd do job: ${jobDir}`
          );
          console.log('[run-queridometro] Enviando evento status: error');
          broadcast(`event: status\ndata: error\n\n`);
          broadcast(`error`);

          setTimeout(() => {
            console.log('[run-queridometro] Fechando streams SSE após erro');
            finishStreaming();
          }, 2000);
        }
        resolve();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        broadcast(`❌ Erro ao finalizar: ${errorMessage}`);
        broadcast(`event: status\ndata: error\n\n`);
        finishStreaming();
        reject(error);
      }
    });

    child.on('error', (error) => {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      broadcast(
        `❌ Erro ao executar: ${errorMessage} (cwd esperado do job: ${jobDir})`
      );
      broadcast(`event: status\ndata: error\n\n`);
      finishStreaming();
      reject(error);
    });

    const timeoutMs = parseInt(process.env.QUERIDOMETRO_TIMEOUT_MS || '900000');
    setTimeout(() => {
      child.kill();
      broadcast(`⏰ Timeout após ${timeoutMs / 1000 / 60} minutos`);
      broadcast(`event: status\ndata: error\n\n`);
      finishStreaming();
      reject(new Error(`[queridômetro] Timeout após ${timeoutMs / 1000 / 60} minutos`));
    }, timeoutMs);
  });
}

function finishStreaming() {
  activeStreams.forEach(controller => {
    try {
      controller.close();
    } catch (error) {
      // Já pode estar fechado
    }
  });
  activeStreams.clear();
  running = false;
}

async function copyLatestResult(): Promise<{ publishedPath: string; sourcePath: string; bytes: number }> {
  const jobDir = resolveQueridometroJobDir();
  const dataDir = join(jobDir, 'data');
  const publicDir = resolveBbbHostingPublicDir();

  try {
    if (!existsSync(dataDir)) {
      throw new Error(`[queridômetro] Pasta data/ ausente em ${jobDir} (o scraper deveria criá-la ao concluir).`);
    }

    const files = readdirSync(dataDir)
      .filter(file => file.endsWith('.json'))
      .map(file => ({
        name: file,
        path: join(dataDir, file),
        stats: statSync(join(dataDir, file))
      }))
      .sort((a, b) => b.stats.mtime.getTime() - a.stats.mtime.getTime());

    if (files.length === 0) {
      throw new Error(`[queridômetro] Nenhum .json em ${dataDir}`);
    }

    const latestFile = files[0];
    const sourcePath = latestFile.path;

    const mainPath = join(publicDir, 'queridometro.json');

    const content = readFileSync(sourcePath, 'utf8');

    const diag = diagnoseQueridometroExport({
      sourcePath,
      publicDir,
      dataDir,
      sortedJsonFiles: files.map((f) => ({ name: f.name })),
      selectedName: latestFile.name,
      content,
    });
    logExportDiagnosis(diag);
    broadcast(
      `📊 Diagnóstico: origem=${diag.sourceFileName} · itens=${diag.itemsTotal} · ok=${diag.itemsOk} · falha busca=${diag.itemsWithFetchError} · candidatos data/=${diag.candidateJsonFilesInData} · ignorados (mtime)=${diag.skippedOlderCandidates}`
    );
    broadcast(`📊 Versão conteúdo=${diag.contentVersion} · bytes=${diag.bytes} · gerado=${diag.generatedAt}`);
    if (diag.skippedOlderCandidates > 0) {
      broadcast(`📊 Motivo ignorados: ${diag.skipReason}`);
    }
    if (diag.itemsWithFetchError > 0 && diag.fetchErrorSamples.length > 0) {
      const sample = diag.fetchErrorSamples
        .map((s) => `${s.slug}(${s.errorType ?? '?'})`)
        .slice(0, 5)
        .join(', ');
      broadcast(`📊 Amostra falhas busca: ${sample}`);
    }

    const mainTempPath = `${mainPath}.tmp`;
    writeFileSync(mainTempPath, content, 'utf8');
    renameSync(mainTempPath, mainPath);

    const latestPath = join(publicDir, 'queridometro-latest.json');
    const latestData = {
      file: 'queridometro.json',
      lastModified: new Date().toISOString(),
      localDate: new Date().toISOString().split('T')[0],
      bytes: Buffer.byteLength(content, 'utf8'),
      sha256: diag.contentSha256,
      version: diag.contentVersion,
    };

    const latestTempPath = `${latestPath}.tmp`;
    writeFileSync(latestTempPath, JSON.stringify(latestData, null, 2), 'utf8');
    renameSync(latestTempPath, latestPath);

    broadcast(`📄 Arquivo atualizado: queridometro.json`);

    return {
      publishedPath: `/tools/bbb-hosting/public/queridometro.json`,
      sourcePath,
      bytes: Buffer.byteLength(content, 'utf8')
    };

  } catch (error) {
    throw new Error(
      `[queridômetro] Falha ao publicar em ${publicDir}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    );
  }
}
