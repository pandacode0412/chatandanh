import { z } from "zod";

export const reportReasons = [
  "spam",
  "harassment",
  "scam",
  "sexual_content",
  "minor_safety",
  "violence",
  "privacy",
  "other"
] as const;

export type ReportReason = (typeof reportReasons)[number];

export const blockRequestSchema = z.object({
  conversationId: z.string().min(1),
  targetParticipantId: z.string().min(1),
  reason: z.string().trim().max(120).optional()
});

export const reportRequestSchema = z.object({
  conversationId: z.string().min(1),
  messageId: z.string().min(1).optional(),
  targetParticipantId: z.string().min(1).optional(),
  reason: z.enum(reportReasons),
  note: z.string().trim().max(1000).optional()
});

export type BlockRequest = z.infer<typeof blockRequestSchema>;
export type ReportRequest = z.infer<typeof reportRequestSchema>;

export interface ReportSummary {
  id: string;
  conversationId: string;
  messageId?: string;
  reason: ReportReason;
  note?: string;
  status: "open" | "reviewing" | "resolved" | "dismissed";
  severity: "low" | "medium" | "high" | "critical";
  createdAt: string;
}
