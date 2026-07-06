import { z } from "zod";
import type { Gender } from "../profile/profile.schema";
import type { UserMode } from "../auth/auth.schema";

export const conversationTypes = ["direct"] as const;
export const messageStatuses = ["sent", "delivered", "failed", "hidden_by_moderation"] as const;
export const imageMessageMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export const maxImageMessageBytes = 1_500_000;
export const maxImageMessageDataUrlLength = 2_100_000;

export type ConversationType = (typeof conversationTypes)[number];
export type MessageStatus = (typeof messageStatuses)[number];
export type ImageMessageMimeType = (typeof imageMessageMimeTypes)[number];

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

export interface PublicMessageAttachment {
  type: "image";
  url: string;
  mimeType: ImageMessageMimeType;
  name?: string;
  size: number;
  alt?: string;
}

export interface PublicMessage {
  id: string;
  clientMessageId?: string;
  conversationId: string;
  sender: PublicParticipant;
  body: string;
  attachment?: PublicMessageAttachment;
  status: MessageStatus;
  createdAt: string;
}

export interface PublicConversation {
  id: string;
  type: ConversationType;
  status: "active" | "ended" | "locked";
  participants: PublicParticipant[];
  startedAt: string;
  endedAt?: string;
}

export const conversationIdSchema = z.object({
  conversationId: z.string().min(1)
});

export const messageAttachmentSchema = z.object({
  type: z.literal("image"),
  url: z.string().trim().min(1).max(maxImageMessageDataUrlLength).refine(
    (value) => value.startsWith("data:image/") || value.startsWith("https://") || value.startsWith("http://"),
    "Ảnh không hợp lệ"
  ),
  mimeType: z.enum(imageMessageMimeTypes),
  name: z.string().trim().max(120).optional(),
  size: z.number().int().min(1).max(maxImageMessageBytes),
  alt: z.string().trim().max(160).optional()
});

export const sendMessageSchema = z.object({
  conversationId: z.string().min(1),
  clientMessageId: z.string().trim().min(1).max(120).optional(),
  body: z.string().trim().max(2000, "Tin nhắn tối đa 2.000 ký tự").default(""),
  attachment: messageAttachmentSchema.optional()
}).superRefine((payload, context) => {
  if (!payload.body && !payload.attachment) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Không thể gửi tin nhắn trống",
      path: ["body"]
    });
  }
});

export const endConversationSchema = z.object({
  conversationId: z.string().min(1).optional(),
  reason: z.string().trim().min(1).max(80).default("user_left")
});

export const engagementEventSchema = z.object({
  type: z.literal("question_suggestion_selected"),
  payload: z.object({
    question: z.string().trim().min(1).max(300)
  })
});

export type SendMessagePayload = z.infer<typeof sendMessageSchema>;
