import { NextResponse } from "next/server";
import { listPolicies } from "@/lib/store";

export const dynamic = "force-dynamic";

export function GET() {
  const modelConfigured = Boolean(process.env.DEEPSEEK_API_KEY?.trim());
  return NextResponse.json({
    status: "ok",
    mode: "standalone",
    storage: "sqlite",
    modelConfigured,
    modelProvider: "deepseek",
    documentParsing: true,
    ocrEnabled: true,
    policyCount: listPolicies().length,
  }, { headers: { "Cache-Control": "no-store" } });
}
