export type AuditEvent = {
  taskId: string;
  eventType: "POLICY_USED" | "NO_EVIDENCE" | "TOOL_CALLED" | "USER_CONFIRMED" | "RISK_TRIGGERED" | "MODEL_RETRY";
  metadata: { riskLevel?: "LOW" | "MEDIUM" | "HIGH" };
  createdAt: Date;
};

const globalForAudit = globalThis as unknown as { smartAiAuditEvents?: AuditEvent[] };
const auditEvents = globalForAudit.smartAiAuditEvents ?? [];
globalForAudit.smartAiAuditEvents = auditEvents;

export function recordAuditEvent(event: AuditEvent) {
  auditEvents.push(event);
  if (auditEvents.length > 500) auditEvents.splice(0, auditEvents.length - 500);
}

export function getAuditEvents(taskId: string) {
  return auditEvents.filter((event) => event.taskId === taskId);
}
