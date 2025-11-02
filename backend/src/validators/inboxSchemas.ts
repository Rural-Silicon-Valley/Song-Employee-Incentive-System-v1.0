import { z } from "zod";

export const submitInactivitySchema = z.object({
  email: z.string().email(),
  reason: z.string().min(3).max(500),
});

export const inboxListSchema = z.object({
  status: z.enum(["PENDING", "RESOLVED"]).optional(),
});

export const inboxResolveSchema = z.object({
  id: z.number().int().positive(),
  note: z.string().min(0).max(500).optional(),
});
