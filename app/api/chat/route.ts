import { NextResponse } from "next/server";
import { chatRequestSchema } from "@/lib/api/schemas";
import { ownedTask, inferServiceType, riskForServiceType, updateDemoTask } from "@/lib/demo-data";
import { requestSession } from "@/lib/security/session";
import { searchPolicies } from "@/lib/rag/retriever";
import { recordAuditEvent } from "@/lib/security/audit";
import { maskSensitiveText } from "@/lib/security/pii";

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_CHAT_INPUT" }, { status: 400 });
  const { taskId, clarification } = parsed.data;
  const task = ownedTask(taskId, requestSession(request));
  if (!task) return NextResponse.json({ error: "TASK_NOT_FOUND" }, { status: 404 });
  const region = parsed.data.region ?? task.region;
  const year = parsed.data.year ?? task.year;
  const safeClarification = clarification ? maskSensitiveText(clarification) : "";
  const message = safeClarification ? `${task.message} ${safeClarification}` : task.message;
  if (message.length > 6000) return NextResponse.json({ message: "补充内容过长，请重新创建任务。" }, { status: 400 });
  const serviceType = task.serviceType === "unknown" ? inferServiceType(message) : task.serviceType;
  const missingFields = serviceType === "unknown"
    ? ["具体想办理的事项"]
    : [
        !region ? "所在省、市、区" : "",
        serviceType === "medical_insurance" && !year ? "办理年份" : "",
      ].filter(Boolean);
  const evidence = missingFields.length
    ? []
    : await searchPolicies(message, {
        region,
        serviceType,
        asOf: year ? new Date(`${year}-12-31`) : new Date(),
      });
  const updated = updateDemoTask(task.id, {
    message,
    serviceType,
    riskLevel: riskForServiceType(serviceType),
    title: serviceType === "medical_insurance" ? "居民医保办理咨询" : serviceType === "student_aid" ? "高校学生资助咨询" : serviceType === "elderly_disability_service" ? "老年与残障服务咨询" : "请补充办理事项",
    knownFacts: [message],
    missingFields,
    evidence,
    region: region ?? task.region,
    year: year ?? task.year,
    userConfirmed: false,
    status: missingFields.length ? "CLARIFYING" : "WAITING_CONFIRMATION",
    plan: missingFields.length ? [] : ["确认当地官方办理渠道", "核对材料是否齐全", "在人工确认后再进行正式办理"],
  });
  if (!missingFields.length) {
    recordAuditEvent({
      taskId: task.id,
      eventType: evidence.length ? "POLICY_USED" : "NO_EVIDENCE",
      metadata: { riskLevel: riskForServiceType(serviceType) },
      createdAt: new Date(),
    });
  }
  return NextResponse.json({
    task: updated,
    message: missingFields.length
      ? `还需要确认：${missingFields.join("、")}`
      : evidence.length
        ? "已完成政策检索。以下为内置政策库摘要，请以官方原文为准。"
        : "没有找到适用的政策证据，因此不提供确定性结论。",
  });
}
