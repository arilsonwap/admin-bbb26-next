import { assertLocalVpsJsonSyncAllowed } from "@/lib/localVpsJsonSyncGuard";
import { NextResponse } from "next/server";

/** Preflight: o cliente chama antes do SSE para exibir mensagem clara em 403. */
export async function GET() {
  const guard = assertLocalVpsJsonSyncAllowed();
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: guard.message }, { status: guard.status });
  }
  return NextResponse.json({ ok: true });
}
