import { z } from "zod";

export const moderationActions = ["ignore", "warn", "mute", "ban", "hide_message", "close_report"] as const;

export const moderationActionSchema = z.object({
  reportId: z.string().min(1).optional(),
  targetSessionId: z.string().min(1).optional(),
  action: z.enum(moderationActions),
  durationMinutes: z.coerce.number().int().positive().optional(),
  note: z.string().trim().max(1000).optional()
});

export interface AdminMetrics {
  onlineUsers: number;
  activeConversations: number;
  messagesLastHour: number;
  openReports: number;
}
