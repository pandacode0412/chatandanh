import { z } from "zod";
import { chatProfileSchema } from "../profile/profile.schema";

export const userModes = ["guest", "registered", "premium"] as const;
export type UserMode = (typeof userModes)[number];

export const createAnonymousSessionSchema = z.object({
  preferredAlias: z.string().trim().min(2).max(30).optional(),
  profile: chatProfileSchema.optional(),
  topicIds: z.array(z.string().trim().min(1)).optional(),
  ageConfirmed: z.boolean().default(true)
});

export const registerSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8),
  displayName: z.string().trim().min(2).max(30),
  profile: chatProfileSchema.omit({ displayName: true }).optional()
});

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8)
});

export const linkSessionSchema = z.object({
  sessionId: z.string().min(1)
});

export type CreateAnonymousSessionRequest = z.infer<typeof createAnonymousSessionSchema>;
export type RegisterRequest = z.infer<typeof registerSchema>;
export type LoginRequest = z.infer<typeof loginSchema>;

export interface CreateAnonymousSessionResponse {
  sessionId: string;
  accessToken: string;
  displayAlias: string;
  avatarKey: string;
  profileComplete: boolean;
  expiresAt: string;
}

export interface AccountSummary {
  id: string;
  email: string;
  displayName: string;
  mode: Extract<UserMode, "registered" | "premium">;
  profileComplete: boolean;
}

export interface AuthResponse {
  account: AccountSummary;
  accessToken: string;
}
