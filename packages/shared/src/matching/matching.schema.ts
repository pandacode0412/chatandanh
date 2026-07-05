import { z } from "zod";
import { genderSchema } from "../profile/profile.schema";

export const defaultMatchingTopicId = "bat-ky";

export const startMatchingSchema = z.object({
  mode: z.literal("direct").default("direct"),
  topicId: z.string().trim().min(1).default(defaultMatchingTopicId),
  preferences: z
    .object({
      desiredGenders: z.array(genderSchema).min(1).max(3).optional(),
      ageRange: z.tuple([z.coerce.number().int().min(18), z.coerce.number().int().max(99)]).optional(),
      location: z.string().trim().min(2).max(80).optional(),
      strictGenderMatch: z.boolean().default(true)
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
  topicId: string;
  timeoutSeconds: number;
  avoidRecentMatches: boolean;
  conversationId?: string;
}
