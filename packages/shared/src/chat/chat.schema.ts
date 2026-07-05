import { z } from "zod";
import type { Gender } from "../profile/profile.schema";
import type { UserMode } from "../auth/auth.schema";

export const conversationTypes = ["direct", "room"] as const;
export const messageStatuses = ["sent", "delivered", "failed", "hidden_by_moderation"] as const;

export type ConversationType = (typeof conversationTypes)[number];
export type MessageStatus = (typeof messageStatuses)[number];

export interface PublicParticipant {
  participantId: string;
  alias: string;
  avatarKey: string;
  mode: UserMode;
  age?: number;
  location?: string;
  gender?: Gender;
  online: boolean;
}

export interface PublicMessage {
  id: string;
  clientMessageId?: string;
  conversationId: string;
  sender: PublicParticipant;
  body: string;
  status: MessageStatus;
  createdAt: string;
}

export interface PublicConversation {
  id: string;
  type: ConversationType;
  topicId?: string;
  roomId?: string;
  status: "active" | "ended" | "locked";
  participants: PublicParticipant[];
  startedAt: string;
  endedAt?: string;
}

export const conversationIdSchema = z.object({
  conversationId: z.string().min(1)
});

export const sendMessageSchema = z.object({
  conversationId: z.string().min(1),
  clientMessageId: z.string().trim().min(1).max(120).optional(),
  body: z.string().trim().min(1, "Không thể gửi tin nhắn trống").max(2000, "Tin nhắn tối đa 2.000 ký tự")
});

export const endConversationSchema = z.object({
  conversationId: z.string().min(1).optional(),
  reason: z.string().trim().min(1).max(80).default("user_left")
});

export const engagementEventSchema = z.object({
  type: z.literal("topic_suggestion_selected"),
  payload: z.object({
    question: z.string().trim().min(1).max(300)
  })
});

export type SendMessagePayload = z.infer<typeof sendMessageSchema>;
