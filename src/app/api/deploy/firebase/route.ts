import { spawn } from "child_process";
import { NextResponse } from "next/server";

let running = false;

export async function POST(): Promise<Response> {
  if (running) {
    return NextResponse.json(
      { success: false, error: "Deploy em execução" },
      { status: 409 }
    );
  }

  running = true;
  return new Promise((resolve) => {
    const child = spawn(
      "bash",
      ["tools/deploy-hosting/deploy-firebase-bbb-26.sh"],
      {
        cwd: process.cwd(),
        env: process.env,
      }
    );

    let output = "";

    child.stdout.on("data", (d) => (output += d.toString()));
    child.stderr.on("data", (d) => (output += d.toString()));

    child.on("close", (code) => {
      running = false;
      resolve(
        NextResponse.json({
          command: "Deploy Firebase Hosting (bbb-26)",
          success: code === 0,
          code,
          log: output,
        })
      );
    });
  });
}