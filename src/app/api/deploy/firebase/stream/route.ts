import { spawn } from "child_process";
import { NextResponse } from "next/server";

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

export async function GET() {
  const stream = new ReadableStream({
    start(controller) {
      activeStreams.add(controller);

      if (running) {
        // Em vez de 409, aceitar conexão e enviar mensagem de erro
        broadcast("❌ Deploy já está em execução. Aguarde a conclusão.");
        activeStreams.forEach(controller => {
          try {
            controller.enqueue(`event: status\ndata: error\n\n`);
          } catch (error) {
            // Já pode estar fechado
          }
        });

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

      // Iniciar o deploy
      const child = spawn(
        "bash",
        ["tools/deploy-hosting/deploy-firebase-bbb-26.sh"],
        {
          cwd: process.cwd(),
          env: process.env,
        }
      );

      // Enviar dados iniciais
      broadcast("🚀 Deploy Firebase Hosting (bbb-26)");
      broadcast(`Início: ${new Date().toLocaleString('pt-BR')}`);
      broadcast("--------------------------------");

      child.stdout.on("data", (data) => {
        const lines = data.toString().split('\n').filter((line: string) => line.trim());
        lines.forEach((line: string) => broadcast(line));
      });

      child.stderr.on("data", (data) => {
        const lines = data.toString().split('\n').filter((line: string) => line.trim());
        lines.forEach((line: string) => broadcast(`❌ ${line}`));
      });

      child.on("close", (code) => {
        broadcast("--------------------------------");

        if (code === 0) {
          broadcast("✅ Deploy concluído com sucesso!");
        } else {
          broadcast(`❌ Deploy falhou com código de saída: ${code}`);
        }

        broadcast(`Fim: ${new Date().toLocaleString('pt-BR')}`);

        // Enviar evento de status
        const status = code === 0 ? 'success' : 'error';
        activeStreams.forEach(controller => {
          try {
            controller.enqueue(`event: status\ndata: ${status}\n\n`);
          } catch (error) {
            // Já pode estar fechado
          }
        });

        // Limpar streams ativos
        activeStreams.forEach(ctrl => {
          try {
            ctrl.close();
          } catch (error) {
            // Já pode estar fechado
          }
        });
        activeStreams.clear();
        running = false;
      });

      child.on("error", (error) => {
        broadcast(`❌ Erro ao executar deploy: ${error.message}`);
        activeStreams.forEach(ctrl => {
          try {
            ctrl.close();
          } catch (err) {
            // Já pode estar fechado
          }
        });
        activeStreams.clear();
        running = false;
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