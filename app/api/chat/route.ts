import { NextResponse } from "next/server";
import { chatRequestSchema } from "@/lib/api/schemas";
import { ownedTask, inferServiceType, riskForServiceType, updateDemoTask } from "@/lib/demo-data";
import { requestSession } from "@/lib/security/session";
import { searchPolicies } from "@/lib/rag/retriever";
import { generateGuidance, answerFollowUp, type Guidance, type GuidanceAnswer } from "@/lib/ai/guidance";
import { recordAuditEvent } from "@/lib/security/audit";
import { maskSensitiveText } from "@/lib/security/pii";

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_CHAT_INPUT" }, { status: 400 });
  const { taskId, clarification, answers = [], followUp } = parsed.data;
  const task = ownedTask(taskId, requestSession(request));
  if (!task) return NextResponse.json({ error: "TASK_NOT_FOUND" }, { status: 404 });
  const region = parsed.data.region ?? task.region;
  const year = parsed.data.year ?? task.year;

  // 结论之后的“继续追问 / 其他情况”：不重跑整份指引，只追加一条针对性回答。
  if (followUp && task.guidance && task.evidence.length) {
    const reply = await answerFollowUp({
      question: followUp.text,
      kind: followUp.kind,
      message: task.message,
      serviceType: task.serviceType,
      region,
      year,
      evidence: task.evidence,
      guidance: task.guidance,
    });
    const nextGuidance: Guidance = {
      ...task.guidance,
      replies: [...(task.guidance.replies ?? []), reply],
    };
    const updated = updateDemoTask(task.id, { guidance: nextGuidance, region: region ?? task.region, year: year ?? task.year });
    recordAuditEvent({
      taskId: task.id,
      eventType: "FOLLOW_UP",
      metadata: { riskLevel: task.riskLevel, kind: followUp.kind },
      createdAt: new Date(),
    });
    return NextResponse.json({ task: updated, reply, message: "已回复您的追问，可在下方继续追问。" });
  }

  const answered: GuidanceAnswer[] = answers.filter((item) => item.answer.trim().length > 0);
  const answerText = answered.map((item) => `${item.question}：${item.answer}`).join("；");
  const followUpAsText = followUp && !(task.guidance && task.evidence.length) ? followUp.text : undefined;
  const extra = [clarification, followUpAsText, answerText].filter(Boolean).join("；");
  const safeClarification = extra ? maskSensitiveText(extra) : "";
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

  // 右侧“依据与材料”命中的条目就是本地知识库；有证据才生成解答，没有证据继续拒答。
  let guidance: Guidance | null = null;
  if (!missingFields.length && evidence.length) {
    try {
      guidance = await generateGuidance({
        message,
        serviceType,
        region,
        year,
        evidence,
        aiSummary: task.aiSummary,
        answered: answered.length ? answered : undefined,
      });
    } catch {
      guidance = null;
    }
  }

  const updated = updateDemoTask(task.id, {
    message,
    serviceType,
    riskLevel: riskForServiceType(serviceType),
    title: serviceType === "medical_insurance" ? "居民医保办理咨询" : serviceType === "student_aid" ? "高校学生资助咨询" : serviceType === "elderly_disability_service" ? "老年与残障服务咨询" : "请补充办理事项",
    knownFacts: [message],
    missingFields,
    evidence,
    guidance,
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
        ? guidance
          ? answered.length
            ? "已按您的回答更新结论与办理步骤，可继续点选剩余问题或直接看流程。"
            : "已按右侧知识库条目生成解答与办理全流程，请先确认下方问题，再对照步骤办理。"
          : "已完成政策检索。以下为内置政策库摘要，请以官方原文为准。"
        : "没有找到适用的政策证据，因此不提供确定性结论。",
  });
}
