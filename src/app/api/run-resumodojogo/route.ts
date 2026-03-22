import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { writeFileSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';

let running = false;
const activeStreams = new Set<ReadableStreamDefaultController>();

// Função para enviar dados para todos os streams ativos
function broadcast(data: string) {
  activeStreams.forEach(controller => {
    try {
      controller.enqueue(`data: ${data}\n\n`);
    } catch (error) {
      // Controller pode ter sido fechado
      activeStreams.delete(controller);
    }
  });
}

const RESUMODOJOGO_PATH = '/home/arilson/PROJETOS/resumodojogo';
const LOCK_FILE = join(tmpdir(), 'resumodojogo-admin-panel.lock');

export async function POST(request: NextRequest) {
  // Verificar se já está executando
  if (running) {
    return NextResponse.json(
      { error: 'Resumo do jogo já está em execução' },
      { status: 409 }
    );
  }

  running = true;

  try {
    // Verificar se o projeto resumodojogo existe
    try {
      readdirSync(RESUMODOJOGO_PATH);
    } catch (error) {
      throw new Error(`Projeto resumodojogo não encontrado em: ${RESUMODOJOGO_PATH}`);
    }

    // Executar o resumo do jogo com streaming
    const executionResult = await executeResumoDoJogo();

    // Encontrar e copiar o arquivo mais recente
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

    console.error('Erro ao executar resumo do jogo:', error);
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

      // Executar o resumo do jogo com streaming em tempo real
      executeResumoDoJogoStreaming().catch(error => {
        console.error('Erro no streaming do resumo do jogo:', error);
        broadcast(`❌ Erro: ${error.message}`);
        broadcast(`event: status\ndata: error\n\n`);

        // Pequeno delay para garantir que o evento chegue ao cliente
        setTimeout(() => {
          finishStreaming();
        }, 500);
      });
    },
    cancel() {
      // Cliente desconectou
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
  return new Promise((resolve, reject) => {
    const logs: string[] = [];
    const startedAt = new Date().toISOString();

    // Executar npm run scrape-all
    const child = spawn('npm', ['run', 'scrape-all'], {
      cwd: RESUMODOJOGO_PATH,
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
        // Pegar as últimas 10 linhas de log
        const logTail = logs.slice(-10);
        resolve({ logTail, startedAt });
      } else {
        reject(new Error(`Script falhou com código de saída: ${code}. Logs: ${logs.join('\n')}`));
      }
    });

    child.on('error', (error) => {
      reject(new Error(`Erro ao executar script: ${error.message}`));
    });

    // Timeout configurável via RESUMODOJOGO_TIMEOUT_MS
    // Padrão: 1200000ms (20 min) para scraping de 24 participantes
    const timeoutMs = parseInt(process.env.RESUMODOJOGO_TIMEOUT_MS || '1200000');
    setTimeout(() => {
      child.kill();
      reject(new Error(`Timeout: execução demorou mais de ${timeoutMs / 1000 / 60} minutos`));
    }, timeoutMs);
  });
}

async function executeResumoDoJogoStreaming(): Promise<void> {
  return new Promise((resolve, reject) => {
    broadcast(`🚀 Iniciando resumo do jogo...`);
    broadcast(`📅 ${new Date().toLocaleString('pt-BR')}`);
    broadcast(`📂 Diretório: ${RESUMODOJOGO_PATH}`);

    // Executar npm run scrape-all
    const child = spawn('npm', ['run', 'scrape-all'], {
      cwd: RESUMODOJOGO_PATH,
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

          // Copiar resultado
          broadcast(`📋 Copiando resultado...`);
          const copyResult = await copyLatestResult();
          broadcast(`📄 Arquivo atualizado: statusbbb.json`);
          broadcast(`📊 ${copyResult.bytes} bytes salvos`);
          broadcast(`🎯 Resultado disponível em: ${copyResult.publishedPath}`);

          broadcast(`✨ Resumo do jogo finalizado!`);

          // Garantir que o evento status seja enviado - múltiplas formas para compatibilidade
          console.log('📤 Enviando evento status: success');
          broadcast(`event: status\ndata: success\n\n`);
          // Também enviar como mensagem normal para fallback
          broadcast(`success`);

          // Delay ainda maior para garantir que o cliente processe
          setTimeout(() => {
            console.log('🔌 Fechando streams SSE após sucesso');
            finishStreaming();
          }, 2000);

        } else {
          broadcast(`❌ Script falhou (código: ${code})`);
          console.log('📤 Enviando evento status: error');
          broadcast(`event: status\ndata: error\n\n`);
          // Também enviar como mensagem normal para fallback
          broadcast(`error`);

          // Delay ainda maior para garantir que o cliente processe
          setTimeout(() => {
            console.log('🔌 Fechando streams SSE após erro');
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
      broadcast(`❌ Erro ao executar: ${error.message}`);
      broadcast(`event: status\ndata: error\n\n`);
      finishStreaming();
      reject(error);
    });

    // Timeout - 20 minutos para scraping de 24 participantes
    const timeoutMs = parseInt(process.env.RESUMODOJOGO_TIMEOUT_MS || '1200000');
    setTimeout(() => {
      child.kill();
      broadcast(`⏰ Timeout após ${timeoutMs / 1000 / 60} minutos`);
      broadcast(`event: status\ndata: error\n\n`);
      finishStreaming();
      reject(new Error(`Timeout: execução demorou mais de ${timeoutMs / 1000 / 60} minutos`));
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
  const sourcePath = join(RESUMODOJOGO_PATH, 'statusbbb.json');

  try {
    // Verificar se o arquivo existe
    statSync(sourcePath);

    // Caminhos de destino
    const fs = require('fs');
    const publicDir = join(process.cwd(), 'tools', 'bbb-hosting', 'public');
    const mainPath = join(publicDir, 'statusbbb.json');

    // Ler o conteúdo
    const content = readFileSync(sourcePath, 'utf8');

    // Criar/atualizar o arquivo principal (statusbbb.json)
    const mainTempPath = `${mainPath}.tmp`;
    writeFileSync(mainTempPath, content, 'utf8');
    fs.renameSync(mainTempPath, mainPath);

    // Atualizar metadados do arquivo mais recente
    const latestPath = join(publicDir, 'statusbbb-latest.json');
    const latestData = {
      file: 'statusbbb.json',
      lastModified: new Date().toISOString(), // UTC para metadados
      localDate: new Date().toISOString().split('T')[0], // Data local para referência
      bytes: Buffer.byteLength(content, 'utf8')
    };

    const latestTempPath = `${latestPath}.tmp`;
    writeFileSync(latestTempPath, JSON.stringify(latestData, null, 2), 'utf8');
    fs.renameSync(latestTempPath, latestPath);

    broadcast(`📄 Arquivo principal atualizado: statusbbb.json`);

    return {
      publishedPath: `/tools/bbb-hosting/public/statusbbb.json`,
      sourcePath,
      bytes: Buffer.byteLength(content, 'utf8')
    };

  } catch (error) {
    throw new Error(`Erro ao copiar resultado: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
  }
}