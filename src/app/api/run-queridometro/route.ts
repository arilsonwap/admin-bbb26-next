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

const QUERIDOMETRO_PATH = '/home/arilson/PROJETOS/queridometro';
const LOCK_FILE = join(tmpdir(), 'queridometro-admin-panel.lock');

export async function POST(request: NextRequest) {
  // Verificar se já está executando
  if (running) {
    return NextResponse.json(
      { error: 'Queridômetro já está em execução' },
      { status: 409 }
    );
  }

  running = true;

  try {
    // Verificar se o projeto queridometro existe
    try {
      readdirSync(QUERIDOMETRO_PATH);
    } catch (error) {
      throw new Error(`Projeto queridômetro não encontrado em: ${QUERIDOMETRO_PATH}`);
    }

    // Executar o queridômetro com streaming
    const executionResult = await executeQueridometro();

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

    console.error('Erro ao executar queridômetro:', error);
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

      // Executar o queridômetro com streaming em tempo real
      executeQueridometroStreaming().catch(error => {
        console.error('Erro no streaming do queridômetro:', error);
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

async function executeQueridometro(): Promise<{ logTail: string[]; startedAt: string }> {
  return new Promise((resolve, reject) => {
    const logs: string[] = [];
    const startedAt = new Date().toISOString();

    // Tentar executar o script bash primeiro
    const child = spawn('bash', ['run-queridometro.sh'], {
      cwd: QUERIDOMETRO_PATH,
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

    // Timeout configurável via QUERIDOMETRO_TIMEOUT_MS
    // Padrão: 300000ms (5 min), recomendado para instabilidade: 900000ms (15 min)
    const timeoutMs = parseInt(process.env.QUERIDOMETRO_TIMEOUT_MS || '300000');
    setTimeout(() => {
      child.kill();
      reject(new Error(`Timeout: execução demorou mais de ${timeoutMs / 1000 / 60} minutos`));
    }, timeoutMs);
  });
}

async function executeQueridometroStreaming(): Promise<void> {
  return new Promise((resolve, reject) => {
    broadcast(`🚀 Iniciando queridômetro...`);
    broadcast(`📅 ${new Date().toLocaleString('pt-BR')}`);
    broadcast(`📂 Diretório: ${QUERIDOMETRO_PATH}`);

    // Tentar executar o script bash
    const child = spawn('bash', ['run-queridometro.sh'], {
      cwd: QUERIDOMETRO_PATH,
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

          // Copiar resultado
          broadcast(`📋 Copiando resultado...`);
          const copyResult = await copyLatestResult();
          broadcast(`📄 Arquivo principal atualizado: queridometro.json`);
          broadcast(`📅 Arquivo datado salvo: ${copyResult.bytes} bytes`);
          broadcast(`🎯 Resultado disponível em: ${copyResult.publishedPath}`);

          broadcast(`✨ Queridômetro finalizado!`);

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
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      broadcast(`❌ Erro ao executar: ${errorMessage}`);
      broadcast(`event: status\ndata: error\n\n`);
      finishStreaming();
      reject(error);
    });

    // Timeout
    const timeoutMs = parseInt(process.env.QUERIDOMETRO_TIMEOUT_MS || '300000');
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
  const dataDir = join(QUERIDOMETRO_PATH, 'data');

  try {
    // Listar arquivos no diretório data
    const files = readdirSync(dataDir)
      .filter(file => file.endsWith('.json'))
      .map(file => ({
        name: file,
        path: join(dataDir, file),
        stats: statSync(join(dataDir, file))
      }))
      .sort((a, b) => b.stats.mtime.getTime() - a.stats.mtime.getTime());

    if (files.length === 0) {
      throw new Error('Nenhum arquivo JSON encontrado no diretório data do queridômetro');
    }

    const latestFile = files[0];
    const sourcePath = latestFile.path;

    // Caminhos de destino
    const fs = require('fs');
    const publicDir = join(process.cwd(), 'tools', 'bbb-hosting', 'public');
    const mainPath = join(publicDir, 'queridometro.json');

    // Ler o conteúdo
    const content = readFileSync(sourcePath, 'utf8');

    // Criar/atualizar o arquivo principal (queridometro.json)
    const mainTempPath = `${mainPath}.tmp`;
    writeFileSync(mainTempPath, content, 'utf8');
    fs.renameSync(mainTempPath, mainPath);

    // Atualizar metadados do arquivo mais recente
    const latestPath = join(publicDir, 'queridometro-latest.json');
    const latestData = {
      file: 'queridometro.json',
      lastModified: new Date().toISOString(), // UTC para metadados
      localDate: new Date().toISOString().split('T')[0], // Data local para referência
      bytes: Buffer.byteLength(content, 'utf8')
    };

    const latestTempPath = `${latestPath}.tmp`;
    writeFileSync(latestTempPath, JSON.stringify(latestData, null, 2), 'utf8');
    fs.renameSync(latestTempPath, latestPath);

    broadcast(`📄 Arquivo atualizado: queridometro.json`);

    return {
      publishedPath: `/tools/bbb-hosting/public/queridometro.json`,
      sourcePath,
      bytes: Buffer.byteLength(content, 'utf8')
    };

  } catch (error) {
    throw new Error(`Erro ao copiar resultado: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
  }
}