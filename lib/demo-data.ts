import type { PolicyEvidence } from "@/lib/rag/types";

export type DemoTask = {
  id: string;
  message: string;
  serviceType: "medical_insurance" | "student_aid" | "elderly_disability_service";
  title: string;
  status: "CLARIFYING" | "RETRIEVING" | "CHECKING_DOCUMENTS" | "WAITING_CONFIRMATION" | "COMPLETED";
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  missingFields: string[];
  knownFacts: string[];
  evidence: PolicyEvidence[];
  plan: string[];
  createdAt: string;
};

const globalForDemo = globalThis as unknown as { smartAiTasks?: Map<string, DemoTask> };
const tasks = globalForDemo.smartAiTasks ?? new Map<string, DemoTask>();
globalForDemo.smartAiTasks = tasks;

export const demoPolicies: PolicyEvidence[] = [
  {
    policyId: "demo-medical-2026-001",
    title: "Smart AI 演示政策：居民医保缴费咨询样例",
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

export function createDemoTask(input: { message: string; region?: string; year?: string }): DemoTask {
  const id = `demo_${Date.now().toString(36)}`;
  const hasRegion = Boolean(input.region?.trim());
  const serviceType = /助学|学生|资助/.test(input.message)
    ? "student_aid"
    : /残障|残疾|老人|老年|行动不便/.test(input.message)
      ? "elderly_disability_service"
      : "medical_insurance";
  const missingFields = serviceType === "medical_insurance"
    ? [!hasRegion ? "所在省、市、区" : "", !input.year ? "办理年份" : ""].filter(Boolean)
    : [!hasRegion ? "所在省、市、区" : ""].filter(Boolean);
  const task: DemoTask = {
    id,
    message: input.message,
    serviceType,
    title: serviceType === "medical_insurance" ? "居民医保办理咨询" : serviceType === "student_aid" ? "高校学生资助咨询" : "老年与残障服务咨询",
    status: missingFields.length ? "CLARIFYING" : "RETRIEVING",
    riskLevel: serviceType === "medical_insurance" ? "HIGH" : "MEDIUM",
    missingFields,
    knownFacts: [input.message],
    evidence: [],
    plan: [],
    createdAt: new Date().toISOString(),
  };
  tasks.set(id, task);
  return task;
}

export function getDemoTask(id: string) {
  return tasks.get(id);
}

export function updateDemoTask(id: string, patch: Partial<DemoTask>) {
  const current = tasks.get(id);
  if (!current) return undefined;
  const next = { ...current, ...patch };
  tasks.set(id, next);
  return next;
}
