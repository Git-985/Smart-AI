import { listAuditRows, recordAuditRow } from "@/lib/store";

export type AuditEvent = {
  taskId: string;
  eventType: "POLICY_USED" | "NO_EVIDENCE" | "TOOL_CALLED" | "USER_CONFIRMED" | "RISK_TRIGGERED" | "MODEL_RETRY";
  metadata: { riskLevel?: "LOW" | "MEDIUM" | "HIGH" };
  createdAt: Date;
};

export function recordAuditEvent(event: AuditEvent) {
  recordAuditRow(event.taskId, event.eventType, event.metadata.riskLevel ?? null, event.createdAt.toISOString());
}

export function getAuditEvents(taskId: string): AuditEvent[] {
  return listAuditRows(taskId).map((row) => ({
    taskId: row.task_id,
    eventType: row.event_type as AuditEvent["eventType"],
    metadata: { riskLevel: (row.risk_level as AuditEvent["metadata"]["riskLevel"]) ?? undefined },
    createdAt: new Date(row.created_at),
  }));
}
