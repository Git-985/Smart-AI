export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export type RiskInput = {
  involvesMedicalDecision?: boolean;
  involvesLegalRight?: boolean;
  involvesMoney?: boolean;
  requiresEligibilityJudgement?: boolean;
  lowConfidence?: boolean;
};

export function calculateRisk(input: RiskInput): RiskLevel {
  if (input.involvesMedicalDecision || input.involvesLegalRight || input.involvesMoney) return "HIGH";
  if (input.requiresEligibilityJudgement || input.lowConfidence) return "MEDIUM";
  return "LOW";
}
