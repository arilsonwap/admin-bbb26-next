import { spawn } from "child_process";

let running = false;
const activeStreams = new Set<ReadableStreamDefaultController>();

function broadcast(data: string) {
  activeStreams.forEach((controller) => {
    try {
      controller.enqueue(`data: ${data}\n\n`);
    } catch {
      activeStreams.delete(controller);
    }
  });
}

function sendFinalStatusAndClose(status: "success" | "error") {
  activeStreams.forEach((controller) => {
    try {
      controller.enqueue(`event: status\ndata: ${status}\n\n`);
    } catch {
      // já pode estar fechado
    }
  });
  activeStreams.forEach((ctrl) => {
    try {
      ctrl.close();
    } catch {
      // já pode estar fechado
    }
  });
  activeStreams.clear();
  running = false;
}

export async function GET() {
  const stream = new ReadableStream({
    start(controller) {
      if (running) {
        try {
          controller.enqueue(`data: ❌ Deploy já está em execução. Aguarde a conclusão.\n\n`);
          controller.enqueue(`event: status\ndata: error\n\n`);
          controller.close();
        } catch {
          // ignore
        }
        return;
      }

      activeStreams.add(controller);
      running = true;

      const child = spawn(
        "bash",
        ["tools/deploy-hosting/deploy-firebase-bbb-26.sh"],
        {
          cwd: process.cwd(),
          env: process.env,
        }
      );

      broadcast("🚀 Deploy Firebase Hosting (bbb-26)");
      broadcast(`Início: ${new Date().toLocaleString("pt-BR")}`);
      broadcast("--------------------------------");

      child.stdout.on("data", (data) => {
        const lines = data
          .toString()
          .split("\n")
          .filter((line: string) => line.trim());
        lines.forEach((line: string) => broadcast(line));
      });

      child.stderr.on("data", (data) => {
        const lines = data
          .toString()
          .split("\n")
          .filter((line: string) => line.trim());
        lines.forEach((line: string) => broadcast(`❌ ${line}`));
      });

      child.on("close", (code) => {
        broadcast("--------------------------------");

        if (code === 0) {
          broadcast("✅ Deploy concluído com sucesso!");
        } else {
          broadcast(`❌ Deploy falhou com código de saída: ${code}`);
        }

        broadcast(`Fim: ${new Date().toLocaleString("pt-BR")}`);

        const status = code === 0 ? "success" : "error";
        sendFinalStatusAndClose(status);
      });

      child.on("error", (error) => {
        broadcast(`❌ Erro ao executar deploy: ${error.message}`);
        sendFinalStatusAndClose("error");
      });
    },
    cancel() {
      activeStreams.forEach((ctrl) => {
        try {
          ctrl.close();
        } catch {
          // já pode estar fechado
        }
      });
      activeStreams.clear();
      // Mantém running === true até o child encerrar; evita deploy duplo e estado incoerente.
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
