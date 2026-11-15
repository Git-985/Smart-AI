import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { deletePolicy, listPolicies, savePolicy } from "@/lib/store";

export const dynamic = "force-dynamic";

const policySchema = z.object({
  title: z.string().trim().min(4).max(200),
  serviceType: z.enum(["medical_insurance", "student_aid", "elderly_disability_service"]),
  region: z.string().trim().min(1).max(60),
  effectiveAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  expiredAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  quote: z.string().trim().min(10).max(4000),
  sourceUrl: z.string().url().max(500),
  section: z.string().trim().max(80).optional(),
  relevance: z.number().min(0).max(1).optional(),
  applicabilityReason: z.string().trim().min(4).max(500),
});

/**
 * 政策库默认只读：本地知识库不允许在界面或匿名接口里被修改。
 * 需要维护时，先在服务端配置 ADMIN_TOKEN，再带口令调用接口。
 */
function writeGuard(request: Request): NextResponse | null {
  const expected = process.env.ADMIN_TOKEN?.trim();
  if (!expected) {
    return NextResponse.json(
      { error: "POLICY_READONLY", message: "政策资料库默认只读，如需更新请在服务端配置 ADMIN_TOKEN。" },
      { status: 403 },
    );
  }
  if (request.headers.get("x-admin-token") !== expected) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  return null;
}

export async function GET() {
  return NextResponse.json({ policies: listPolicies() }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const denied = writeGuard(request);
  if (denied) return denied;
  const body: unknown = await request.json().catch(() => null);
  const parsed = policySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_POLICY", details: parsed.error.flatten() }, { status: 400 });
  }
  const policy = {
    policyId: `policy_${randomUUID()}`,
    title: parsed.data.title,
    serviceType: parsed.data.serviceType,
    region: parsed.data.region,
    effectiveAt: parsed.data.effectiveAt ?? null,
    expiredAt: parsed.data.expiredAt ?? null,
    quote: parsed.data.quote,
    sourceUrl: parsed.data.sourceUrl,
    section: parsed.data.section,
    relevance: parsed.data.relevance ?? 0.9,
    applicabilityReason: parsed.data.applicabilityReason,
  };
  savePolicy(policy);
  return NextResponse.json({ policy }, { status: 201 });
}

export async function DELETE(request: Request) {
  const denied = writeGuard(request);
  if (denied) return denied;
  const id = new URL(request.url).searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ error: "MISSING_ID" }, { status: 400 });
  return NextResponse.json({ deleted: deletePolicy(id) });
}
