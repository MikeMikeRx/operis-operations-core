import { z } from "zod";

export const CreateProductBody = z.object({
  sku: z.string().min(1).max(64),
  name: z.string().min(1).max(200),
  unit: z.string().min(1).max(32).optional(),
});

export const UpdateProductBody = z.object({
  name: z.string().min(1).max(200).optional(),
  unit: z.string().min(1).max(32).optional(),
}).refine((v) => Object.keys(v).length > 0, { message: "no fields to update" });
