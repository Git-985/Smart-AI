import { NextResponse } from "next/server";
import { searchPolicies } from "@/lib/rag/retriever";

export async function POST(request: Request) {
  const body = await request.json() as { query?: string; region?: string; serviceType?: string; year?: string };
  const items = await searchPolicies(body.query ?? "", {
    region: body.region,
    serviceType: body.serviceType,
    asOf: body.year ? new Date(`${body.year}-12-31`) : new Date(),
  });
  return NextResponse.json({
    items,
    status: items.length ? "DEMO_EVIDENCE_ONLY" : "NO_POLICY_DATA",
    message: items.length ? "以下为虚构演示证据，不代表官方政策。" : "没有匹配的已验证政策资料，不能据此作出政策结论。",
  });
}
