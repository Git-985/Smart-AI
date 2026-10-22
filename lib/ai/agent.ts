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
