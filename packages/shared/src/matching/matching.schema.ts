import { z } from "zod";
import { genderSchema } from "../profile/profile.schema";

export const startMatchingSchema = z.object({
  mode: z.literal("direct").default("direct"),
  preferences: z
    .object({
      desiredGenders: z.array(genderSchema).min(1).max(3).optional(),
      strictGenderMatch: z.boolean().default(true),
      enableAgeFilter: z.boolean().default(false),
      ageRange: z
        .object({
          min: z.coerce.number().int().min(18).max(99).optional(),
          max: z.coerce.number().int().min(18).max(99).optional()
        })
        .optional(),
      enableGenderFilter: z.boolean().default(false),
      enableLocationFilter: z.boolean().default(false),
      desiredLocations: z.array(z.string()).max(10).optional()
    })
    .optional()
});

export const cancelMatchingSchema = z.object({
  requestId: z.string().min(1)
});

export type StartMatchingRequest = z.infer<typeof startMatchingSchema>;

export interface StartMatchingResponse {
  requestId: string;
  status: "queued" | "paired";
  timeoutSeconds: number;
  avoidRecentMatches: boolean;
  conversationId?: string;
}
