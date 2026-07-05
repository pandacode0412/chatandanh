import { z } from "zod";
import type { UserMode } from "../auth/auth.schema";
import type { Gender } from "../profile/profile.schema";
import type { ReportReason, ReportSummary } from "../safety/safety.schema";

export const moderationActions = ["ignore", "warn", "mute", "ban", "hide_message", "close_report"] as const;
export type ModerationAction = (typeof moderationActions)[number];

export const moderationActionSchema = z.object({
  reportId: z.string().min(1).optional(),
  targetSessionId: z.string().min(1).optional(),
  action: z.enum(moderationActions),
  durationMinutes: z.coerce.number().int().positive().optional(),
  note: z.string().trim().max(1000).optional()
});

export interface AdminMetrics {
  totalUsers: number;
  totalAccounts: number;
  onlineUsers: number;
  newUsersLast24h: number;
  activeUsersLast24h: number;
  activeConversations: number;
  messagesLastHour: number;
  totalMessages: number;
  totalReports: number;
  openReports: number;
  bannedUsers: number;
  mutedUsers: number;
  reportRatePer1000Messages: number;
}

export interface AdminReasonStat {
  reason: ReportReason;
  count: number;
}

export interface AdminSeverityStat {
  severity: ReportSummary["severity"];
  count: number;
}

export interface AdminUserSummary {
  sessionId: string;
  accountId?: string;
  alias: string;
  emailMasked?: string;
  mode: UserMode;
  role: "user" | "moderator" | "admin";
  status: "active" | "muted" | "banned" | "expired";
  banUntil?: string;
  muteUntil?: string;
  banCount: number;
  reportCount: number;
  reportsLast24h: number;
  online: boolean;
  profileComplete: boolean;
  displayName?: string;
  age?: number;
  location?: string;
  gender?: Gender;
  createdAt: string;
  lastSeenAt?: string;
}

export interface AdminReportSummary extends ReportSummary {
  reporterAlias: string;
  targetSessionId?: string;
  targetAlias?: string;
  targetStatus?: AdminUserSummary["status"];
  targetBanUntil?: string;
  targetReportCount: number;
  targetBanCount: number;
}

export interface ModerationActionSummary {
  id: string;
  reportId?: string;
  targetSessionId?: string;
  actorSessionId: string;
  action: ModerationAction;
  durationMinutes?: number;
  note?: string;
  createdAt: string;
}

export interface AdminOverview {
  metrics: AdminMetrics;
  reportsByReason: AdminReasonStat[];
  reportsBySeverity: AdminSeverityStat[];
  recentReports: AdminReportSummary[];
  watchedUsers: AdminUserSummary[];
  recentActions: ModerationActionSummary[];
}
