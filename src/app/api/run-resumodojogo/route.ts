import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { writeFileSync, readFileSync, statSync, renameSync } from 'fs';
import { join } from 'path';
import {
  assertResumodojogoRunnable,
  resolveBbbHostingPublicDir,
  resolveResumodojogoJobDir,
} from '@/lib/internalJobsRuntimePaths';
import {
  diagnoseResumodojogoExport,
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
      { error: 'Resumo do jogo já está em execução' },
      { status: 409 }
    );
  }

  running = true;

  try {
    const jobDir = resolveResumodojogoJobDir();
    assertResumodojogoRunnable(jobDir);

    const executionResult = await executeResumoDoJogo();
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

    console.error('[run-resumodojogo]', error);
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function GET() {
  const stream = new ReadableStream({
    start(controller) {
      activeStreams.add(controller);

      if (running) {
        broadcast("❌ Resumo do jogo já está em execução. Aguarde a conclusão.");
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

      executeResumoDoJogoStreaming().catch(error => {
        console.error('[run-resumodojogo] Erro no streaming:', error);
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

async function executeResumoDoJogo(): Promise<{ logTail: string[]; startedAt: string }> {
  const jobDir = resolveResumodojogoJobDir();
  assertResumodojogoRunnable(jobDir);

  return new Promise((resolve, reject) => {
    const logs: string[] = [];
    const startedAt = new Date().toISOString();

    const child = spawn('npm', ['run', 'scrape-all'], {
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
            `[resumo do jogo] npm run scrape-all encerrou com código ${code} (cwd=${jobDir}). Últimos logs:\n${logs.slice(-15).join('\n')}`
          )
        );
      }
    });

    child.on('error', (error) => {
      reject(
        new Error(
          `[resumo do jogo] Não foi possível iniciar npm (cwd=${jobDir}): ${error.message}. Confira se node e npm estão no PATH.`
        )
      );
    });

    const timeoutMs = parseInt(process.env.RESUMODOJOGO_TIMEOUT_MS || '1200000');
    setTimeout(() => {
      child.kill();
      reject(new Error(`[resumo do jogo] Timeout após ${timeoutMs / 1000 / 60} minutos (cwd=${jobDir})`));
    }, timeoutMs);
  });
}

async function executeResumoDoJogoStreaming(): Promise<void> {
  let jobDir: string;
  try {
    jobDir = resolveResumodojogoJobDir();
    assertResumodojogoRunnable(jobDir);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    broadcast(`❌ ${msg}`);
    broadcast(`event: status\ndata: error\n\n`);
    finishStreaming();
    throw err;
  }

  return new Promise((resolve, reject) => {
    broadcast(`🚀 Iniciando resumo do jogo...`);
    broadcast(`📅 ${new Date().toLocaleString('pt-BR')}`);
    broadcast(`📂 Diretório: ${jobDir}`);

    const child = spawn('npm', ['run', 'scrape-all'], {
      cwd: jobDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, NODE_ENV: 'production' }
    });

    let hasStarted = false;

    child.stdout.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter((line: string) => line.trim());
      lines.forEach((line: string) => {
        if (!hasStarted && (line.includes('Iniciando') || line.includes('Starting') || line.includes('🚀'))) {
          hasStarted = true;
          broadcast(`✅ Script iniciado`);
        }
        broadcast(`📝 ${line}`);
      });
    });

    child.stderr.on('data', (data: Buffer) => {
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
          broadcast(`📄 Arquivo atualizado: statusbbb.json`);
          broadcast(`📊 ${copyResult.bytes} bytes salvos`);
          broadcast(`🎯 Resultado disponível em: ${copyResult.publishedPath}`);

          broadcast(`✨ Resumo do jogo finalizado!`);

          console.log('[run-resumodojogo] Enviando evento status: success');
          broadcast(`event: status\ndata: success\n\n`);
          broadcast(`success`);

          setTimeout(() => {
            console.log('[run-resumodojogo] Fechando streams SSE após sucesso');
            finishStreaming();
          }, 2000);

        } else {
          broadcast(`❌ Script falhou (código: ${code})`);
          broadcast(
            `💡 Dica: verifique logs acima e dependências em internal-jobs/resumodojogo (npm ci). cwd do job: ${jobDir}`
          );
          console.log('[run-resumodojogo] Enviando evento status: error');
          broadcast(`event: status\ndata: error\n\n`);
          broadcast(`error`);

          setTimeout(() => {
            console.log('[run-resumodojogo] Fechando streams SSE após erro');
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
      broadcast(
        `❌ Erro ao executar: ${error.message} (cwd esperado do job: ${jobDir})`
      );
      broadcast(`event: status\ndata: error\n\n`);
      finishStreaming();
      reject(error);
    });

    const timeoutMs = parseInt(process.env.RESUMODOJOGO_TIMEOUT_MS || '1200000');
    setTimeout(() => {
      child.kill();
      broadcast(`⏰ Timeout após ${timeoutMs / 1000 / 60} minutos`);
      broadcast(`event: status\ndata: error\n\n`);
      finishStreaming();
      reject(new Error(`[resumo do jogo] Timeout após ${timeoutMs / 1000 / 60} minutos`));
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
  const jobDir = resolveResumodojogoJobDir();
  const sourcePath = join(jobDir, 'statusbbb.json');
  const publicDir = resolveBbbHostingPublicDir();

  try {
    statSync(sourcePath);

    const mainPath = join(publicDir, 'statusbbb.json');

    const content = readFileSync(sourcePath, 'utf8');

    const diag = diagnoseResumodojogoExport({
      sourcePath,
      publicDir,
      content,
    });
    logExportDiagnosis(diag);
    broadcast(
      `📊 Diagnóstico: origem=statusbbb.json · dataBusca=${diag.dataBusca ?? 'n/d'} · participantes=${diag.participantesInFile} · ok=${diag.participantesOk} · erro scraper=${diag.participantesComErroScraper}`
    );
    broadcast(`📊 Versão conteúdo=${diag.contentVersion} · bytes=${diag.bytes} · gerado=${diag.generatedAt}`);
    if (diag.participantesComErroScraper > 0 && diag.scraperErrorSamples.length > 0) {
      const sample = diag.scraperErrorSamples
        .map((s) => `${s.id ?? s.url ?? '?'}`)
        .slice(0, 5)
        .join(', ');
      broadcast(`📊 Amostra erros scraper: ${sample}`);
    }

    const mainTempPath = `${mainPath}.tmp`;
    writeFileSync(mainTempPath, content, 'utf8');
    renameSync(mainTempPath, mainPath);

    const latestPath = join(publicDir, 'statusbbb-latest.json');
    const latestData = {
      file: 'statusbbb.json',
      lastModified: new Date().toISOString(),
      localDate: new Date().toISOString().split('T')[0],
      bytes: Buffer.byteLength(content, 'utf8'),
      sha256: diag.contentSha256,
      version: diag.contentVersion,
    };

    const latestTempPath = `${latestPath}.tmp`;
    writeFileSync(latestTempPath, JSON.stringify(latestData, null, 2), 'utf8');
    renameSync(latestTempPath, latestPath);

    broadcast(`📄 Arquivo principal atualizado: statusbbb.json`);

    return {
      publishedPath: `/api/hosting-public/statusbbb.json`,
      sourcePath,
      bytes: Buffer.byteLength(content, 'utf8')
    };

  } catch (error) {
    throw new Error(
      `[resumo do jogo] Falha ao publicar (origem ${sourcePath} → ${publicDir}): ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    );
  }
}
