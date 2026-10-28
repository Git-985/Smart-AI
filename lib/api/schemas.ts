import { z } from "zod";

export const taskCreateSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  region: z.string().trim().max(100).optional(),
  year: z.string().regex(/^\d{4}$/).optional(),
});

export const chatRequestSchema = z.object({
  taskId: z.string().regex(/^demo_[a-z0-9-]+$/),
  region: z.string().trim().min(1).max(100).optional(),
  year: z.string().regex(/^\d{4}$/).optional(),
  clarification: z.string().trim().min(1).max(1000).optional(),
});

export const documentMetadataSchema = z.object({
  mimeType: z.enum(["image/jpeg", "image/png", "application/pdf"]),
  size: z.number().int().positive().max(10 * 1024 * 1024),
});

export const policySearchSchema = z.object({
  query: z.string().trim().min(1).max(1000),
  region: z.string().trim().min(1).max(100),
  serviceType: z.enum(["medical_insurance", "student_aid", "elderly_disability_service"]),
  year: z.string().regex(/^\d{4}$/),
});

export const confirmationSchema = z.object({
  taskId: z.string().regex(/^demo_[a-z0-9-]+$/),
  acknowledged: z.literal(true),
});
