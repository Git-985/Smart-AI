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

function authorized(request: Request) {
  const expected = process.env.ADMIN_TOKEN?.trim();
  if (!expected) return true;
  return request.headers.get("x-admin-token") === expected;
}

export async function GET() {
  return NextResponse.json({ policies: listPolicies() }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
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
  if (!authorized(request)) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ error: "MISSING_ID" }, { status: 400 });
  return NextResponse.json({ deleted: deletePolicy(id) });
}
