import { NextResponse } from "next/server";
import { taskCreateSchema } from "@/lib/api/schemas";
import { createDemoTask } from "@/lib/demo-data";
import { analyzeTaskWithDeepSeek, deepseekConfigured } from "@/lib/ai/deepseek";
import { attachSession, createSession, requestSession } from "@/lib/security/session";

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = taskCreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_TASK_INPUT" }, { status: 400 });
  const session = requestSession(request) ?? createSession();
  const analysis = deepseekConfigured() ? await analyzeTaskWithDeepSeek(parsed.data.message) : null;
  return attachSession(NextResponse.json(createDemoTask(parsed.data, session, analysis ?? undefined)), session, request);
}
