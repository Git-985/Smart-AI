import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  const modelConfigured = Boolean(process.env.DEEPSEEK_API_KEY?.trim());
  return NextResponse.json({
    status: "ok",
    mode: "demo",
    storage: "process-memory",
    modelConfigured,
    modelProvider: "deepseek",
    documentParsing: true,
    ocrEnabled: false,
  }, { headers: { "Cache-Control": "no-store" } });
}
