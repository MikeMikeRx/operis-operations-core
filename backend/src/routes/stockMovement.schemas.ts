import { z } from "zod";

export const CreateStockMovementBody = z.object({
    productId: z.string().uuid(),
    type: z.enum(["IN", "OUT", "ADJUST", "TRANSFER"]),
    quantity: z.number().int().positive(),
    reason: z.string().min(1).max(500).optional(),
    reference: z.string().min(1).max(200).optional(),
});

export type CreateStockMovementBodyType = z.infer<typeof CreateStockMovementBody>;