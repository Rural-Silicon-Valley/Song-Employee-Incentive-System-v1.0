import { z } from "zod";

export const heartbeatSchema = z.object({
  minutes: z.number().int().min(1).max(60).optional().default(1),
});
