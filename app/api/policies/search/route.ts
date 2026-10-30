import { NextResponse } from "next/server";
import { policySearchSchema } from "@/lib/api/schemas";
import { searchPolicies } from "@/lib/rag/retriever";

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = policySearchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_POLICY_SEARCH" }, { status: 400 });
  const items = await searchPolicies(parsed.data.query, {
    region: parsed.data.region,
    serviceType: parsed.data.serviceType,
    asOf: new Date(`${parsed.data.year}-12-31`),
  });
  return NextResponse.json({
    items,
    status: items.length ? "POLICY_EVIDENCE" : "NO_POLICY_DATA",
    message: items.length ? "以下为内置政策库摘要，具体以官方原文和当地经办口径为准。" : "没有匹配的已验证政策资料，不能据此作出政策结论。",
  });
}
