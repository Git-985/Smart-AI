export type AuditEvent = {
  taskId: string;
  eventType: "POLICY_USED" | "TOOL_CALLED" | "USER_CONFIRMED" | "RISK_TRIGGERED" | "MODEL_RETRY";
  metadata: Record<string, unknown>;
  createdAt: Date;
};

export function safeAuditMetadata(metadata: Record<string, unknown>) {
  const forbidden = /api.?key|secret|token|raw.?content|document.?text/i;
  return Object.fromEntries(Object.entries(metadata).filter(([key]) => !forbidden.test(key)));
}
