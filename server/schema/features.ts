import { z } from "zod";

export const featureCreateSchema = z.object({
  categoryId: z.number().int().positive("Category ID is required"),
  name: z.string().min(1, "Feature name is required").trim(),
});

export const featureUpdateSchema = z.object({
  name: z.string().min(1, "Feature name is required").trim(),
});


