import { NextResponse } from "next/server";
import { taskCreateSchema } from "@/lib/api/schemas";
import { createDemoTask } from "@/lib/demo-data";
import { attachSession, createSession, requestSession } from "@/lib/security/session";

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = taskCreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_TASK_INPUT" }, { status: 400 });
  const session = requestSession(request) ?? createSession();
  return attachSession(NextResponse.json(createDemoTask(parsed.data, session)), session, request);
}
