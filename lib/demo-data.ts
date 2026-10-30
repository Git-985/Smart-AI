import type { PolicyEvidence } from "@/lib/rag/types";
import type { DeepSeekAnalysis } from "@/lib/ai/deepseek";
import { maskSensitiveText } from "@/lib/security/pii";
import { randomUUID } from "node:crypto";

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

const globalForDemo = globalThis as unknown as { smartAiTasks?: Map<string, DemoTask> };
const tasks = globalForDemo.smartAiTasks ?? new Map<string, DemoTask>();
globalForDemo.smartAiTasks = tasks;
const ownerGlobal = globalThis as unknown as { smartAiOwners?: Map<string, string> };
const owners = ownerGlobal.smartAiOwners ?? new Map<string, string>();
ownerGlobal.smartAiOwners = owners;

export const demoPolicies: PolicyEvidence[] = [
  {
    policyId: "demo-medical-2026-001",
    title: "Smart AI 演示政策：居民医保缴费咨询样例",
    serviceType: "medical_insurance",
    region: "演示地区",
    effectiveAt: "2026-01-01",
    expiredAt: null,
    quote: "本条为虚构演示条款，不代表任何地区的真实政策。正式办理前请以当地医保部门公开信息为准。",
    sourceUrl: "https://example.com/smart-ai-demo-policy",
    section: "演示数据说明",
    relevance: 1,
    applicabilityReason: "仅用于展示证据卡片和风险提示，不用于真实资格判断。",
  },
];

export function inferServiceType(message: string): DemoTask["serviceType"] {
  if (/医保|医疗|参保|缴费/.test(message)) return "medical_insurance";
  if (/助学|学生|资助/.test(message)) return "student_aid";
  if (/残障|残疾|老人|老年|行动不便/.test(message)) return "elderly_disability_service";
  return "unknown";
}

export function riskForServiceType(serviceType: DemoTask["serviceType"]): DemoTask["riskLevel"] {
  return serviceType === "medical_insurance" ? "HIGH" : "MEDIUM";
}

export function createDemoTask(
  input: { message: string; region?: string; year?: string },
  owner?: string,
  analysis?: DeepSeekAnalysis,
): DemoTask {
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
    region: input.region,
    year: input.year,
    analysisSource: analysis ? "deepseek" : "rules",
    aiSummary: analysis?.summary,
  };
  tasks.set(id, task);
  if (owner) owners.set(id, owner);
  return task;
}

export function getDemoTask(id: string) {
  const task = tasks.get(id);
  if (task && Date.now() - Date.parse(task.createdAt) >= 86400000) {
    tasks.delete(id);
    owners.delete(id);
    return undefined;
  }
  return task;
}

export function ownedTask(id: string, owner: string | undefined) {
  return owner && owners.get(id) === owner ? getDemoTask(id) : undefined;
}

export function updateDemoTask(id: string, patch: Partial<DemoTask>) {
  const current = getDemoTask(id);
  if (!current) return undefined;
  const next = { ...current, ...patch };
  tasks.set(id, next);
  return next;
}
