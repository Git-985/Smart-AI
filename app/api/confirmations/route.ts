import { NextResponse } from "next/server";
import { confirmationSchema } from "@/lib/api/schemas";
import { ownedTask, updateDemoTask } from "@/lib/demo-data";
import { requestSession } from "@/lib/security/session";
import { recordAuditEvent } from "@/lib/security/audit";

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = confirmationSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_CONFIRMATION" }, { status: 400 });
  const task = ownedTask(parsed.data.taskId, requestSession(request));
  if (!task) return NextResponse.json({ error: "TASK_NOT_FOUND" }, { status: 404 });
  if (task.status !== "WAITING_CONFIRMATION") {
    return NextResponse.json({ error: "TASK_NOT_WAITING_FOR_CONFIRMATION" }, { status: 409 });
  }
  const updated = updateDemoTask(task.id, { userConfirmed: true });
  recordAuditEvent({
    taskId: task.id,
    eventType: "USER_CONFIRMED",
    metadata: { riskLevel: task.riskLevel },
    createdAt: new Date(),
  });
  return NextResponse.json({
    taskId: task.id,
    acknowledged: true,
    taskStatus: updated?.status,
    message: "已记录您了解演示结果的适用范围；这不代表正式申请已提交或完成。",
  });
}
