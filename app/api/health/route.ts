import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    status: "ok",
    mode: "demo",
    storage: "process-memory",
    modelConfigured: false,
    ocrEnabled: false,
  }, { headers: { "Cache-Control": "no-store" } });
}
