export type AgentState =
  | "UNDERSTAND"
  | "CLARIFY"
  | "RETRIEVE"
  | "CHECK_DOCUMENTS"
  | "PLAN"
  | "RISK_REVIEW"
  | "CONFIRM"
  | "FINALIZE";

export type AgentContext = {
  missingFields: string[];
  hasPolicyEvidence: boolean;
  requiresConfirmation: boolean;
};

export type AgentDecision = { state: AgentState; terminal: boolean };

export function classifyService(message: string): AgentContext & { serviceType: string } {
  const serviceType = /助学|学生|资助/.test(message)
    ? "student_aid"
    : /残障|残疾|老人|老年|行动不便/.test(message)
      ? "elderly_disability_service"
      : /医保|医疗|参保|缴费/.test(message)
        ? "medical_insurance"
        : "unknown";
  const missingFields = serviceType === "unknown" ? ["具体想办理的事项"] : ["所在省、市、区"];
  return { serviceType, missingFields, hasPolicyEvidence: false, requiresConfirmation: serviceType !== "unknown" };
}

export function nextAgentState(state: AgentState, context: AgentContext): AgentDecision {
  switch (state) {
    case "UNDERSTAND":
      return { state: context.missingFields.length ? "CLARIFY" : "RETRIEVE", terminal: context.missingFields.length > 0 };
    case "CLARIFY":
      return { state: "CLARIFY", terminal: true };
    case "RETRIEVE":
      return { state: context.hasPolicyEvidence ? "CHECK_DOCUMENTS" : "CLARIFY", terminal: !context.hasPolicyEvidence };
    case "CHECK_DOCUMENTS":
      return { state: "PLAN", terminal: false };
    case "PLAN":
      return { state: "RISK_REVIEW", terminal: false };
    case "RISK_REVIEW":
      return { state: context.requiresConfirmation ? "CONFIRM" : "FINALIZE", terminal: context.requiresConfirmation };
    case "CONFIRM":
      return { state: "CONFIRM", terminal: true };
    case "FINALIZE":
      return { state: "FINALIZE", terminal: true };
  }
}
