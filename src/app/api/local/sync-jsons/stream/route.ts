import { spawn } from "child_process";

import { assertLocalVpsJsonSyncAllowed } from "@/lib/localVpsJsonSyncGuard";
import { NextResponse } from "next/server";

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
  const guard = assertLocalVpsJsonSyncAllowed();
  if (!guard.ok) {
    return NextResponse.json({ error: guard.message }, { status: guard.status });
  }

  const stream = new ReadableStream({
    start(controller) {
      if (running) {
        try {
          controller.enqueue(`data: ❌ Sincronização já em execução. Aguarde.\n\n`);
          controller.enqueue(`event: status\ndata: error\n\n`);
          controller.close();
        } catch {
          // ignore
        }
        return;
      }

      activeStreams.add(controller);
      running = true;

      const child = spawn("bash", ["tools/local-sync/baixar-jsons-vps.sh"], {
        cwd: process.cwd(),
        env: process.env,
      });

      broadcast("📥 Baixar JSONs do VPS → projeto local (DEV)");
      broadcast("Somente máquina local + next dev (ou override documentado no código).");
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
          broadcast("✅ Sincronização concluída.");
        } else {
          broadcast(`❌ Falhou com código de saída: ${code}`);
        }

        broadcast(`Fim: ${new Date().toLocaleString("pt-BR")}`);

        const status = code === 0 ? "success" : "error";
        sendFinalStatusAndClose(status);
      });

      child.on("error", (error) => {
        broadcast(`❌ Erro ao executar script: ${error.message}`);
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
