import type { PolicyEvidence } from "@/lib/rag/types";
import type { DeepSeekAnalysis } from "@/lib/ai/deepseek";
import { maskSensitiveText } from "@/lib/security/pii";
import { randomUUID } from "node:crypto";
import { deleteTask, findTask, purgeExpiredTasks, saveTask, type StoredTask } from "@/lib/store";

export type DemoTask = {
  id: string;
  message: string;
  serviceType: "medical_insurance" | "student_aid" | "elderly_disability_service" | "unknown";
  title: string;
  status: "CLARIFYING" | "RETRIEVING" | "CHECKING_DOCUMENTS" | "WAITING_CONFIRMATION" | "COMPLETED";
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  missingFields: string[];
  knownFacts: string[];
  evidence: PolicyEvidence[];
  plan: string[];
  createdAt: string;
  userConfirmed?: boolean;
  region?: string;
  year?: string;
  analysisSource?: "deepseek" | "rules";
  aiSummary?: string;
};

function toTask(row: StoredTask): DemoTask {
  return {
    id: row.id,
    message: row.message,
    serviceType: row.serviceType as DemoTask["serviceType"],
    title: row.title,
    status: row.status as DemoTask["status"],
    riskLevel: row.riskLevel as DemoTask["riskLevel"],
    missingFields: row.missingFields,
    knownFacts: row.knownFacts,
    evidence: row.evidence,
    plan: row.plan,
    createdAt: row.createdAt,
    userConfirmed: row.userConfirmed,
    region: row.region ?? undefined,
    year: row.year ?? undefined,
    analysisSource: row.analysisSource,
    aiSummary: row.aiSummary ?? undefined,
  };
}

export function inferServiceType(message: string): DemoTask["serviceType"] {
  if (/医保|医疗|参保|缴费|报销|慢病|异地就医/.test(message)) return "medical_insurance";
  if (/助学|学生|资助|奖学金|贷款|学费|绿色通道/.test(message)) return "student_aid";
  if (/残障|残疾|老人|老年|高龄|补贴|护理|适老化|无障碍|特困/.test(message)) return "elderly_disability_service";
  return "unknown";
}

export function riskForServiceType(serviceType: DemoTask["serviceType"]): DemoTask["riskLevel"] {
  if (serviceType === "medical_insurance" || serviceType === "elderly_disability_service") return "HIGH";
  return "MEDIUM";
}

export function createDemoTask(
  input: { message: string; region?: string; year?: string },
  owner?: string,
  analysis?: DeepSeekAnalysis,
): DemoTask {
  purgeExpiredTasks();
  const id = `demo_${randomUUID()}`;
  const safeMessage = maskSensitiveText(input.message);
  const serviceType = analysis?.serviceType ?? inferServiceType(safeMessage);
  const hasRegion = Boolean(input.region?.trim());
  const missingFields = serviceType === "unknown"
    ? ["具体想办理的事项"]
    : serviceType === "medical_insurance"
    ? [!hasRegion ? "所在省、市、区" : "", !input.year ? "办理年份" : ""].filter(Boolean)
    : [!hasRegion ? "所在省、市、区" : ""].filter(Boolean);
  const knownFacts = analysis?.knownFacts?.length ? analysis.knownFacts.slice(0, 6) : [safeMessage];
  const task: DemoTask = {
    id,
    message: safeMessage,
    serviceType,
    title: serviceType === "medical_insurance" ? "居民医保办理咨询" : serviceType === "student_aid" ? "高校学生资助咨询" : serviceType === "elderly_disability_service" ? "老年与残障服务咨询" : "请补充办理事项",
    status: missingFields.length ? "CLARIFYING" : "RETRIEVING",
    riskLevel: riskForServiceType(serviceType),
    missingFields,
    knownFacts,
    evidence: [],
    plan: [],
    createdAt: new Date().toISOString(),
    userConfirmed: false,
    region: input.region,
    year: input.year,
    analysisSource: analysis ? "deepseek" : "rules",
    aiSummary: analysis?.summary,
  };
  saveTask({ ...toStored(task, owner ?? null) });
  return task;
}

function toStored(task: DemoTask, owner: string | null): StoredTask {
  return {
    id: task.id,
    owner,
    message: task.message,
    serviceType: task.serviceType,
    title: task.title,
    status: task.status,
    riskLevel: task.riskLevel,
    missingFields: task.missingFields,
    knownFacts: task.knownFacts,
    evidence: task.evidence,
    plan: task.plan,
    createdAt: task.createdAt,
    userConfirmed: task.userConfirmed ?? false,
    region: task.region ?? null,
    year: task.year ?? null,
    analysisSource: task.analysisSource ?? "rules",
    aiSummary: task.aiSummary ?? null,
  };
}

export function getDemoTask(id: string) {
  purgeExpiredTasks();
  const row = findTask(id);
  if (!row) return undefined;
  if (Date.now() - Date.parse(row.createdAt) >= 86400000) {
    deleteTask(id);
    return undefined;
  }
  return toTask(row);
}

export function ownedTask(id: string, owner: string | undefined) {
  if (!owner) return undefined;
  const task = getDemoTask(id);
  const row = findTask(id);
  return task && row?.owner === owner ? task : undefined;
}

export function updateDemoTask(id: string, patch: Partial<DemoTask>) {
  const current = getDemoTask(id);
  if (!current) return undefined;
  const row = findTask(id);
  const next: DemoTask = { ...current, ...patch };
  saveTask(toStored(next, row?.owner ?? null));
  return next;
}
