import { z } from "zod";

export const serviceTypeSchema = z.enum([
  "medical_insurance",
  "student_aid",
  "elderly_disability_service",
  "unknown",
]);

export const taskAnalysisSchema = z.object({
  serviceType: serviceTypeSchema,
  summary: z.string().min(1),
  knownFacts: z.array(z.string()),
  missingFields: z.array(z.string()),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH"]),
  nextAction: z.enum(["ASK_CLARIFICATION", "SEARCH_POLICY", "CHECK_DOCUMENTS", "GENERATE_PLAN"]),
});

export type TaskAnalysis = z.infer<typeof taskAnalysisSchema>;
