import { NextResponse } from "next/server";
import { listPolicies } from "@/lib/store";
import { deepseekConfigured } from "@/lib/ai/deepseek";

export const dynamic = "force-dynamic";

export function GET() {
  const modelConfigured = deepseekConfigured();
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
