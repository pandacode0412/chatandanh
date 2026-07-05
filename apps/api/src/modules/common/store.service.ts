import { Inject, Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import {
  type AccountSummary,
  type AdminOverview,
  type AdminMetrics,
  type AdminReportSummary,
  type AdminUserSummary,
  type ChatProfile,
  type CreateAnonymousSessionResponse,
  type Gender,
  type ModerationAction,
  type ModerationActionSummary,
  type PublicConversation,
  type PublicMessage,
  type PublicParticipant,
  type ReportReason,
  type ReportSummary,
  type StartMatchingResponse,
  reportReasons
} from "@chatandanh/shared";
import { randomUUID, createHmac } from "node:crypto";
import { AppException } from "../../common/app-exception";

interface SessionRecord {
  id: string;
  accountId?: string;
  mode: "guest" | "registered" | "premium";
  role: "user" | "moderator" | "admin";
  baseAlias: string;
  avatarKey: string;
  profileComplete: boolean;
  status: "active" | "muted" | "banned" | "expired";
  profile: ChatProfile | null;
  expiresAt: string;
  muteUntil?: string;
  banUntil?: string;
  banCount: number;
  online: boolean;
  createdAt: string;
  lastSeenAt: string;
}

interface AccountRecord {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  role: "user" | "moderator" | "admin";
  profile: ChatProfile | null;
  banUntil?: string;
  banCount: number;
  createdAt: string;
}

interface ConversationMemberRecord {
  id: string;
  sessionId: string;
  publicAlias: string;
  publicAvatarKey: string;
  publicAge?: number;
  publicLocation?: string;
  publicGender?: Gender;
  joinedAt: string;
  leftAt?: string;
}

interface ConversationRecord {
  id: string;
  type: "direct";
  status: "active" | "ended" | "locked";
  members: ConversationMemberRecord[];
  messages: PublicMessage[];
  startedAt: string;
  endedAt?: string;
  questionSuggestionEmitted: boolean;
}

interface MatchingRequestRecord {
  requestId: string;
  sessionId: string;
  desiredGenders: Gender[];
  strictGenderMatch: boolean;
  enableAgeFilter: boolean;
  ageRange?: { min?: number; max?: number };
  enableGenderFilter: boolean;
  enableLocationFilter: boolean;
  desiredLocations?: string[];
  createdAt: number;
}

interface BlockRecord {
  id: string;
  blockerSessionId: string;
  blockedSessionId: string;
  conversationId?: string;
  reason?: string;
  createdAt: string;
}

interface ReportRecord extends ReportSummary {
  reporterSessionId: string;
  targetSessionId?: string;
}

interface ModerationActionRecord extends ModerationActionSummary {}

const AUTO_BAN_REPORT_THRESHOLD = 3;
const BASE_AUTO_BAN_DAYS = 14;
const MAX_AUTO_BAN_DAYS = 180;

@Injectable()
export class StoreService {
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly accounts = new Map<string, AccountRecord>();
  private readonly accountsByEmail = new Map<string, string>();
  private readonly conversations = new Map<string, ConversationRecord>();
  private readonly matchingQueue: MatchingRequestRecord[] = [];
  private readonly matchHistory = new Set<string>();
  private readonly blocks: BlockRecord[] = [];
  private readonly reports: ReportRecord[] = [];
  private readonly moderationActions: ModerationActionRecord[] = [];

  constructor(@Inject(EventEmitter2) private readonly events: EventEmitter2) {}

  createAnonymousSession(profile?: ChatProfile, preferredAlias?: string): Omit<CreateAnonymousSessionResponse, "accessToken"> {
    const id = makeId("ses");
    const alias = preferredAlias?.trim() || randomAlias();
    const session: SessionRecord = {
      id,
      mode: "guest",
      role: "user",
      baseAlias: alias,
      avatarKey: randomAvatarKey(),
      profileComplete: Boolean(profile),
      status: "active",
      profile: profile ?? null,
      banCount: 0,
      online: false,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString()
    };
    this.sessions.set(id, session);
    return {
      sessionId: session.id,
      displayAlias: `${session.baseAlias} ${session.id.slice(-3)}`,
      avatarKey: session.avatarKey,
      profileComplete: session.profileComplete,
      expiresAt: session.expiresAt
    };
  }

  createAccount(email: string, passwordHash: string, displayName: string, profile: ChatProfile | null): AccountRecord {
    const normalized = email.toLowerCase();
    if (this.accountsByEmail.has(normalized)) {
      throw new AppException("VALIDATION_ERROR", "Email đã được đăng ký");
    }

    const role = normalized.endsWith("@admin.local") ? "admin" : normalized.endsWith("@moderator.local") ? "moderator" : "user";
    const account: AccountRecord = {
      id: makeId("acc"),
      email: normalized,
      passwordHash,
      displayName,
      role,
      profile,
      banCount: 0,
      createdAt: new Date().toISOString()
    };
    this.accounts.set(account.id, account);
    this.accountsByEmail.set(normalized, account.id);
    return account;
  }

  findAccountByEmail(email: string): AccountRecord | null {
    const accountId = this.accountsByEmail.get(email.toLowerCase());
    return accountId ? this.accounts.get(accountId) ?? null : null;
  }

  createSessionForAccount(account: AccountRecord): SessionRecord {
    const profile = account.profile;
    const banUntil = account.banUntil && Date.parse(account.banUntil) > Date.now() ? account.banUntil : undefined;
    const session: SessionRecord = {
      id: makeId("ses"),
      accountId: account.id,
      mode: "registered",
      role: account.role,
      baseAlias: account.displayName,
      avatarKey: randomAvatarKey(),
      profileComplete: Boolean(profile),
      status: banUntil ? "banned" : "active",
      profile,
      banUntil,
      banCount: account.banCount,
      online: false,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString()
    };
    this.sessions.set(session.id, session);
    return session;
  }

  toAccountSummary(account: AccountRecord): AccountSummary {
    return {
      id: account.id,
      email: account.email,
      displayName: account.displayName,
      mode: "registered",
      role: account.role,
      profileComplete: Boolean(account.profile)
    };
  }

  getSession(sessionId: string): SessionRecord {
    const session = this.sessions.get(sessionId);
    if (!session || session.status === "expired") {
      throw new AppException("SESSION_EXPIRED", "Phiên ẩn danh đã hết hạn", 401);
    }
    this.refreshRestriction(session);
    return session;
  }

  setOnline(sessionId: string, online: boolean): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.online = online;
      session.lastSeenAt = new Date().toISOString();
    }
  }

  getOnlineCount(): number {
    let count = 0;
    for (const session of this.sessions.values()) {
      if (session.online && session.status === "active") {
        count++;
      }
    }
    return count;
  }

  getProfile(sessionId: string): ChatProfile | null {
    return this.getSession(sessionId).profile;
  }

  updateProfile(sessionId: string, profile: ChatProfile): ChatProfile {
    const session = this.getSession(sessionId);
    session.profile = profile;
    session.profileComplete = true;

    if (session.accountId) {
      const account = this.accounts.get(session.accountId);
      if (account) {
        account.profile = profile;
        account.displayName = profile.displayName;
      }
    }

    return profile;
  }

  startMatching(
    sessionId: string,
    preferences?: {
      desiredGenders?: Gender[];
      strictGenderMatch?: boolean;
      enableAgeFilter?: boolean;
      ageRange?: { min?: number; max?: number };
      enableGenderFilter?: boolean;
      enableLocationFilter?: boolean;
      desiredLocations?: string[];
    }
  ): StartMatchingResponse {
    const session = this.getSession(sessionId);
    this.assertCanInteract(session, "Bạn đang bị hạn chế nên chưa thể tìm người lạ.");
    if (!session.profileComplete || !session.profile) {
      throw new AppException("PROFILE_REQUIRED", "Vui lòng hoàn tất hồ sơ trước khi tìm người lạ", 400);
    }
    if (this.matchingQueue.some((request) => request.sessionId === sessionId)) {
      throw new AppException("MATCHING_ALREADY_IN_QUEUE", "Bạn đang trong hàng chờ tìm người lạ", 409);
    }

    const currentRequest: MatchingRequestRecord = {
      requestId: makeId("match_req"),
      sessionId,
      desiredGenders: preferences?.desiredGenders?.length ? preferences.desiredGenders : session.profile.desiredGenders,
      strictGenderMatch: preferences?.strictGenderMatch ?? true,
      enableAgeFilter: preferences?.enableAgeFilter ?? false,
      ageRange: preferences?.ageRange,
      enableGenderFilter: preferences?.enableGenderFilter ?? false,
      enableLocationFilter: preferences?.enableLocationFilter ?? false,
      desiredLocations: preferences?.desiredLocations,
      createdAt: Date.now()
    };

    const compatible = this.matchingQueue.filter((candidate) => this.isCompatible(currentRequest, candidate));
    const fresh = compatible.filter((candidate) => !this.hasMatchedRecently(sessionId, candidate.sessionId));
    const selected = fresh[0] ?? compatible[0];

    if (!selected) {
      this.matchingQueue.push(currentRequest);
      return {
        requestId: currentRequest.requestId,
        status: "queued",
        timeoutSeconds: 60,
        avoidRecentMatches: true
      };
    }

    this.removeMatchingRequest(selected.requestId);
    const conversation = this.createDirectConversation(sessionId, selected.sessionId);
    this.matchHistory.add(pairKey(sessionId, selected.sessionId));
    this.events.emit("matching.paired", {
      conversationId: conversation.id,
      sessionIds: [sessionId, selected.sessionId]
    });

    return {
      requestId: currentRequest.requestId,
      status: "paired",
      timeoutSeconds: 60,
      avoidRecentMatches: true,
      conversationId: conversation.id
    };
  }

  cancelMatching(sessionId: string, requestId: string): void {
    const index = this.matchingQueue.findIndex((request) => request.sessionId === sessionId && request.requestId === requestId);
    if (index >= 0) {
      this.matchingQueue.splice(index, 1);
    }
  }

  getConversationForSession(conversationId: string, sessionId: string): ConversationRecord {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new AppException("CONVERSATION_NOT_FOUND", "Không tìm thấy cuộc trò chuyện", 404);
    }
    if (!conversation.members.some((member) => member.sessionId === sessionId)) {
      throw new AppException("FORBIDDEN", "Bạn không thuộc cuộc trò chuyện này", 403);
    }
    return conversation;
  }

  getPublicConversation(conversationId: string, sessionId: string): PublicConversation {
    return toPublicConversation(this.getConversationForSession(conversationId, sessionId), this.sessions);
  }

  getMessages(conversationId: string, sessionId: string, limit = 30): PublicMessage[] {
    const conversation = this.getConversationForSession(conversationId, sessionId);
    return conversation.messages.slice(-Math.min(limit, 50));
  }

  sendMessage(sessionId: string, conversationId: string, body: string, clientMessageId?: string): PublicMessage {
    this.assertCanInteract(this.getSession(sessionId), "Bạn đang bị hạn chế nên chưa thể gửi tin nhắn.");
    const conversation = this.getConversationForSession(conversationId, sessionId);
    if (conversation.status !== "active") {
      throw new AppException("CONVERSATION_NOT_FOUND", "Cuộc trò chuyện đã kết thúc", 404);
    }
    const trimmed = body.trim();
    if (!trimmed) {
      throw new AppException("VALIDATION_ERROR", "Không thể gửi tin nhắn trống");
    }
    if (trimmed.length > 2000) {
      throw new AppException("MESSAGE_TOO_LONG", "Tin nhắn tối đa 2.000 ký tự");
    }

    const senderMember = conversation.members.find((member) => member.sessionId === sessionId);
    if (!senderMember) {
      throw new AppException("FORBIDDEN", "Bạn không thuộc cuộc trò chuyện này", 403);
    }

    if (clientMessageId) {
      const existing = conversation.messages.find(
        (message) => message.clientMessageId === clientMessageId && message.sender.participantId === senderMember.id
      );
      if (existing) {
        return existing;
      }
    }

    const message: PublicMessage = {
      id: makeId("msg"),
      clientMessageId,
      conversationId,
      sender: toPublicParticipant(senderMember, this.getSession(sessionId)),
      body: trimmed,
      status: "sent",
      createdAt: new Date().toISOString()
    };
    conversation.messages.push(message);
    return message;
  }

  endConversation(sessionId: string, conversationId: string, reason: string): { endedBy: string; endedAt: string } {
    const conversation = this.getConversationForSession(conversationId, sessionId);
    const member = conversation.members.find((item) => item.sessionId === sessionId);
    conversation.status = "ended";
    conversation.endedAt = new Date().toISOString();
    return { endedBy: member?.id ?? "unknown", endedAt: conversation.endedAt };
  }

  shouldEmitQuestionSuggestion(conversationId: string): boolean {
    const conversation = this.conversations.get(conversationId);
    if (!conversation || conversation.questionSuggestionEmitted || conversation.status !== "active") {
      return false;
    }
    return conversation.type === "direct" && conversation.messages.length >= 10;
  }

  markQuestionSuggestionEmitted(conversationId: string): void {
    const conversation = this.conversations.get(conversationId);
    if (conversation) {
      conversation.questionSuggestionEmitted = true;
    }
  }

  getOtherParticipant(conversationId: string, sessionId: string): PublicParticipant {
    const conversation = this.getConversationForSession(conversationId, sessionId);
    const member = conversation.members.find((item) => item.sessionId !== sessionId);
    if (!member) {
      throw new AppException("CONVERSATION_NOT_FOUND", "Không tìm thấy người trò chuyện", 404);
    }
    return toPublicParticipant(member, this.getSession(member.sessionId));
  }

  getSelfParticipantId(conversationId: string, sessionId: string): string {
    const conversation = this.getConversationForSession(conversationId, sessionId);
    return conversation.members.find((member) => member.sessionId === sessionId)?.id ?? "";
  }

  block(sessionId: string, conversationId: string, targetParticipantId: string, reason?: string): void {
    const conversation = this.getConversationForSession(conversationId, sessionId);
    const target = conversation.members.find((member) => member.id === targetParticipantId);
    if (!target) {
      throw new AppException("VALIDATION_ERROR", "Không tìm thấy người cần chặn");
    }
    this.blocks.push({
      id: makeId("block"),
      blockerSessionId: sessionId,
      blockedSessionId: target.sessionId,
      conversationId,
      reason,
      createdAt: new Date().toISOString()
    });
  }

  report(
    sessionId: string,
    conversationId: string,
    reason: ReportReason,
    note?: string,
    messageId?: string,
    targetParticipantId?: string
  ): ReportSummary {
    const conversation = this.getConversationForSession(conversationId, sessionId);
    const target = targetParticipantId
      ? conversation.members.find((member) => member.id === targetParticipantId)
      : conversation.members.find((member) => member.sessionId !== sessionId);
    const report: ReportRecord = {
      id: makeId("rep"),
      reporterSessionId: sessionId,
      targetSessionId: target?.sessionId,
      conversationId,
      messageId,
      reason,
      note,
      status: "open",
      severity: severityForReason(reason),
      createdAt: new Date().toISOString()
    };
    this.reports.push(report);
    if (target?.sessionId) {
      this.applyAutoBanIfNeeded(target.sessionId, report);
    }
    return report;
  }

  listReports(filter: { status?: ReportSummary["status"]; reason?: ReportReason; limit?: number } = {}): AdminReportSummary[] {
    const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
    return [...this.reports]
      .filter((report) => !filter.status || report.status === filter.status)
      .filter((report) => !filter.reason || report.reason === filter.reason)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map((report) => this.toAdminReportSummary(report));
  }

  listAdminUsers(limit = 100): AdminUserSummary[] {
    return Array.from(this.sessions.values())
      .map((session) => {
        this.refreshRestriction(session);
        return this.toAdminUserSummary(session);
      })
      .sort((a, b) => {
        if (b.reportCount !== a.reportCount) {
          return b.reportCount - a.reportCount;
        }
        return b.createdAt.localeCompare(a.createdAt);
      })
      .slice(0, Math.min(Math.max(limit, 1), 200));
  }

  adminOverview(): AdminOverview {
    return {
      metrics: this.metrics(),
      reportsByReason: this.reportsByReason(),
      reportsBySeverity: this.reportsBySeverity(),
      recentReports: this.listReports({ limit: 20 }),
      watchedUsers: this.listAdminUsers(30).filter((user) => user.reportCount > 0 || user.status === "banned" || user.status === "muted"),
      recentActions: [...this.moderationActions].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 20)
    };
  }

  applyModerationAction(
    actorSessionId: string,
    payload: {
      reportId?: string;
      targetSessionId?: string;
      action: ModerationAction;
      durationMinutes?: number;
      note?: string;
    }
  ): ModerationActionSummary {
    const report = payload.reportId ? this.reports.find((item) => item.id === payload.reportId) : undefined;
    const targetSessionId = payload.targetSessionId ?? report?.targetSessionId;
    const action = payload.action;

    if ((action === "warn" || action === "mute" || action === "ban") && !targetSessionId) {
      throw new AppException("VALIDATION_ERROR", "Thiếu user cần xử lý");
    }

    if (action === "hide_message" && report?.messageId) {
      this.hideMessage(report.conversationId, report.messageId);
    }

    if (action === "mute" && targetSessionId) {
      this.applyRestriction(targetSessionId, "mute", payload.durationMinutes ?? 60);
    }

    let resolvedDurationMinutes = payload.durationMinutes;
    if (action === "ban" && targetSessionId) {
      resolvedDurationMinutes = payload.durationMinutes ?? this.nextBanMinutes(targetSessionId);
      this.applyRestriction(targetSessionId, "ban", resolvedDurationMinutes);
    }

    if (report) {
      report.status = action === "ignore" ? "dismissed" : "resolved";
    }

    const record = this.createModerationAction(actorSessionId, {
      reportId: report?.id ?? payload.reportId,
      targetSessionId,
      action,
      durationMinutes: resolvedDurationMinutes,
      note: payload.note
    });
    return record;
  }

  metrics(): AdminMetrics {
    const sessions = Array.from(this.sessions.values());
    sessions.forEach((session) => this.refreshRestriction(session));
    const conversations = Array.from(this.conversations.values());
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;
    const hourAgo = now - 60 * 60 * 1000;
    const totalMessages = conversations.reduce((sum, conversation) => sum + conversation.messages.length, 0);
    const messagesLastHour = conversations.reduce(
      (sum, conversation) => sum + conversation.messages.filter((message) => Date.parse(message.createdAt) >= hourAgo).length,
      0
    );
    return {
      totalUsers: sessions.length,
      totalAccounts: this.accounts.size,
      onlineUsers: sessions.filter((session) => session.online).length,
      newUsersLast24h: sessions.filter((session) => Date.parse(session.createdAt) >= dayAgo).length,
      activeUsersLast24h: sessions.filter((session) => Date.parse(session.lastSeenAt) >= dayAgo).length,
      activeConversations: conversations.filter((conversation) => conversation.status === "active").length,
      messagesLastHour,
      totalMessages,
      totalReports: this.reports.length,
      openReports: this.reports.filter((report) => report.status === "open").length,
      bannedUsers: sessions.filter((session) => session.status === "banned").length,
      mutedUsers: sessions.filter((session) => session.status === "muted").length,
      reportRatePer1000Messages: totalMessages ? Math.round((this.reports.length / totalMessages) * 10000) / 10 : 0
    };
  }

  private applyAutoBanIfNeeded(targetSessionId: string, report: ReportRecord): void {
    const reportCount = this.reportCountForTarget(targetSessionId);
    if (reportCount < AUTO_BAN_REPORT_THRESHOLD || reportCount % AUTO_BAN_REPORT_THRESHOLD !== 0) {
      return;
    }

    const durationMinutes = this.nextBanMinutes(targetSessionId);
    this.applyRestriction(targetSessionId, "ban", durationMinutes);
    const days = Math.round(durationMinutes / 60 / 24);
    this.createModerationAction("system", {
      reportId: report.id,
      targetSessionId,
      action: "ban",
      durationMinutes,
      note: `Tự động ban ${days} ngày vì user bị báo cáo ${reportCount} lần.`
    });
    report.status = "resolved";
  }

  private applyRestriction(targetSessionId: string, restriction: "mute" | "ban", durationMinutes: number): void {
    const target = this.sessions.get(targetSessionId);
    if (!target) {
      throw new AppException("VALIDATION_ERROR", "Không tìm thấy user cần xử lý");
    }

    const until = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();
    if (restriction === "mute") {
      target.status = "muted";
      target.muteUntil = until;
    } else {
      target.status = "banned";
      target.banUntil = until;
      target.banCount += 1;
      this.cancelRequestsForSession(targetSessionId);
      this.endActiveConversationsForSession(targetSessionId, "moderation_ban");
      if (target.accountId) {
        const account = this.accounts.get(target.accountId);
        if (account) {
          account.banUntil = until;
          account.banCount = target.banCount;
        }
        for (const session of this.sessions.values()) {
          if (session.accountId === target.accountId) {
            session.status = "banned";
            session.banUntil = until;
            session.banCount = target.banCount;
            this.cancelRequestsForSession(session.id);
          }
        }
      }
    }
  }

  private createModerationAction(
    actorSessionId: string,
    payload: {
      reportId?: string;
      targetSessionId?: string;
      action: ModerationAction;
      durationMinutes?: number;
      note?: string;
    }
  ): ModerationActionRecord {
    const record: ModerationActionRecord = {
      id: makeId("mod"),
      actorSessionId,
      reportId: payload.reportId,
      targetSessionId: payload.targetSessionId,
      action: payload.action,
      durationMinutes: payload.durationMinutes,
      note: payload.note,
      createdAt: new Date().toISOString()
    };
    this.moderationActions.push(record);
    return record;
  }

  private nextBanMinutes(targetSessionId: string): number {
    const target = this.sessions.get(targetSessionId);
    const banCount = target?.banCount ?? 0;
    const days = Math.min(BASE_AUTO_BAN_DAYS * 2 ** banCount, MAX_AUTO_BAN_DAYS);
    return days * 24 * 60;
  }

  private hideMessage(conversationId: string, messageId: string): void {
    const conversation = this.conversations.get(conversationId);
    const message = conversation?.messages.find((item) => item.id === messageId);
    if (message) {
      message.status = "hidden_by_moderation";
      message.body = "Tin nhắn đã bị ẩn bởi quản trị viên.";
    }
  }

  private toAdminReportSummary(report: ReportRecord): AdminReportSummary {
    const target = report.targetSessionId ? this.sessions.get(report.targetSessionId) : undefined;
    if (target) {
      this.refreshRestriction(target);
    }
    return {
      id: report.id,
      conversationId: report.conversationId,
      messageId: report.messageId,
      reason: report.reason,
      note: report.note,
      status: report.status,
      severity: report.severity,
      createdAt: report.createdAt,
      reporterAlias: this.sessionAlias(report.reporterSessionId),
      targetSessionId: report.targetSessionId,
      targetAlias: report.targetSessionId ? this.sessionAlias(report.targetSessionId) : undefined,
      targetStatus: target?.status,
      targetBanUntil: target?.banUntil,
      targetReportCount: report.targetSessionId ? this.reportCountForTarget(report.targetSessionId) : 0,
      targetBanCount: target?.banCount ?? 0
    };
  }

  private toAdminUserSummary(session: SessionRecord): AdminUserSummary {
    const account = session.accountId ? this.accounts.get(session.accountId) : undefined;
    return {
      sessionId: session.id,
      accountId: session.accountId,
      alias: `${session.baseAlias} ${session.id.slice(-3)}`,
      emailMasked: account?.email ? maskEmail(account.email) : undefined,
      mode: session.mode,
      role: session.role,
      status: session.status,
      banUntil: session.banUntil,
      muteUntil: session.muteUntil,
      banCount: session.banCount,
      reportCount: this.reportCountForTarget(session.id),
      reportsLast24h: this.reportCountForTarget(session.id, Date.now() - 24 * 60 * 60 * 1000),
      online: session.online,
      profileComplete: session.profileComplete,
      displayName: session.profile?.displayName ?? session.baseAlias,
      age: session.profile?.age,
      location: session.profile?.location,
      gender: session.profile?.gender,
      createdAt: session.createdAt,
      lastSeenAt: session.lastSeenAt
    };
  }

  private reportsByReason(): { reason: ReportReason; count: number }[] {
    return reportReasons.map((reason) => ({
      reason,
      count: this.reports.filter((report) => report.reason === reason).length
    }));
  }

  private reportsBySeverity(): { severity: ReportSummary["severity"]; count: number }[] {
    return (["low", "medium", "high", "critical"] as ReportSummary["severity"][]).map((severity) => ({
      severity,
      count: this.reports.filter((report) => report.severity === severity).length
    }));
  }

  private reportCountForTarget(targetSessionId: string, since?: number): number {
    return this.reports.filter(
      (report) => report.targetSessionId === targetSessionId && (!since || Date.parse(report.createdAt) >= since)
    ).length;
  }

  private sessionAlias(sessionId: string): string {
    const session = this.sessions.get(sessionId);
    return session ? `${session.baseAlias} ${session.id.slice(-3)}` : "User không xác định";
  }

  private refreshRestriction(session: SessionRecord): void {
    const now = Date.now();
    if (session.status === "banned" && session.banUntil && Date.parse(session.banUntil) <= now) {
      session.status = "active";
      session.banUntil = undefined;
    }
    if (session.status === "muted" && session.muteUntil && Date.parse(session.muteUntil) <= now) {
      session.status = "active";
      session.muteUntil = undefined;
    }
  }

  private assertCanInteract(session: SessionRecord, message: string): void {
    this.refreshRestriction(session);
    if (session.status === "banned") {
      throw new AppException("FORBIDDEN", `${message} Lệnh cấm hết hạn lúc ${formatViDateTime(session.banUntil)}.`, 403);
    }
    if (session.status === "muted") {
      throw new AppException("FORBIDDEN", `${message} Hạn chế hết hạn lúc ${formatViDateTime(session.muteUntil)}.`, 403);
    }
  }

  private cancelRequestsForSession(sessionId: string): void {
    for (let index = this.matchingQueue.length - 1; index >= 0; index -= 1) {
      if (this.matchingQueue[index]?.sessionId === sessionId) {
        this.matchingQueue.splice(index, 1);
      }
    }
  }

  private endActiveConversationsForSession(sessionId: string, reason: string): void {
    for (const conversation of this.conversations.values()) {
      if (conversation.status === "active" && conversation.members.some((member) => member.sessionId === sessionId)) {
        conversation.status = "ended";
        conversation.endedAt = new Date().toISOString();
        this.events.emit("conversation.ended", { conversationId: conversation.id, reason });
      }
    }
  }

  private createDirectConversation(sessionAId: string, sessionBId: string): ConversationRecord {
    const conversation: ConversationRecord = {
      id: makeId("conv"),
      type: "direct",
      status: "active",
      members: [this.createMember(sessionAId), this.createMember(sessionBId)],
      messages: [],
      startedAt: new Date().toISOString(),
      questionSuggestionEmitted: false
    };
    this.conversations.set(conversation.id, conversation);
    return conversation;
  }

  private createMember(sessionId: string): ConversationMemberRecord {
    const session = this.getSession(sessionId);
    const profile = session.profile;
    return {
      id: makeId("part"),
      sessionId,
      publicAlias: `${profile?.displayName ?? session.baseAlias} ${session.id.slice(-3)}`,
      publicAvatarKey: randomAvatarKey(),
      publicAge: profile?.age,
      publicLocation: profile?.location,
      publicGender: profile?.gender,
      joinedAt: new Date().toISOString()
    };
  }

  private isCompatible(current: MatchingRequestRecord, candidate: MatchingRequestRecord): boolean {
    if (current.sessionId === candidate.sessionId) {
      return false;
    }
    if (this.isBlocked(current.sessionId, candidate.sessionId)) {
      return false;
    }
    const currentProfile = this.getSession(current.sessionId).profile;
    const candidateSession = this.getSession(candidate.sessionId);
    if (candidateSession.status === "banned" || candidateSession.status === "muted") {
      return false;
    }
    const candidateProfile = candidateSession.profile;
    if (!currentProfile || !candidateProfile) {
      return false;
    }

    // 1. Check gender filter compatibility (which defaults to profile choice or matching filters)
    if (!current.desiredGenders.includes(candidateProfile.gender)) {
      return false;
    }
    if (!candidate.desiredGenders.includes(currentProfile.gender)) {
      return false;
    }

    // 2. Check age range compatibility
    if (current.enableAgeFilter && current.ageRange) {
      const { min, max } = current.ageRange;
      if (min !== undefined && candidateProfile.age < min) return false;
      if (max !== undefined && candidateProfile.age > max) return false;
    }
    if (candidate.enableAgeFilter && candidate.ageRange) {
      const { min, max } = candidate.ageRange;
      if (min !== undefined && currentProfile.age < min) return false;
      if (max !== undefined && currentProfile.age > max) return false;
    }

    // 3. Check location compatibility
    if (current.enableLocationFilter && current.desiredLocations) {
      if (!current.desiredLocations.includes(candidateProfile.location)) {
        return false;
      }
    }
    if (candidate.enableLocationFilter && candidate.desiredLocations) {
      if (!candidate.desiredLocations.includes(currentProfile.location)) {
        return false;
      }
    }

    return true;
  }

  private isBlocked(sessionA: string, sessionB: string): boolean {
    return this.blocks.some(
      (block) =>
        (block.blockerSessionId === sessionA && block.blockedSessionId === sessionB) ||
        (block.blockerSessionId === sessionB && block.blockedSessionId === sessionA)
    );
  }

  private hasMatchedRecently(sessionA: string, sessionB: string): boolean {
    return this.matchHistory.has(pairKey(sessionA, sessionB));
  }

  private removeMatchingRequest(requestId: string): void {
    const index = this.matchingQueue.findIndex((request) => request.requestId === requestId);
    if (index >= 0) {
      this.matchingQueue.splice(index, 1);
    }
  }
}

function toPublicConversation(conversation: ConversationRecord, sessions: Map<string, SessionRecord>): PublicConversation {
  return {
    id: conversation.id,
    type: conversation.type,
    status: conversation.status,
    participants: conversation.members.map((member) => toPublicParticipant(member, sessions.get(member.sessionId)!)),
    startedAt: conversation.startedAt,
    endedAt: conversation.endedAt
  };
}

function toPublicParticipant(member: ConversationMemberRecord, session: SessionRecord): PublicParticipant {
  return {
    participantId: member.id,
    alias: member.publicAlias,
    avatarKey: member.publicAvatarKey,
    mode: session.mode,
    age: member.publicAge,
    location: member.publicLocation,
    gender: member.publicGender,
    online: session.online
  };
}

function pairKey(sessionA: string, sessionB: string): string {
  return [sessionA, sessionB].sort().join(":");
}

function makeId(prefix: string): string {
  return `${prefix}_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
}

function randomAlias(): string {
  const names = ["Mây", "Gió", "Sao", "Nắng", "Mưa", "Cỏ", "Biển", "Trăng"];
  return names[Math.floor(Math.random() * names.length)];
}

function randomAvatarKey(): string {
  const colors = ["blue", "green", "pink", "purple", "amber", "teal"];
  const number = String(Math.ceil(Math.random() * 6)).padStart(2, "0");
  return `avatar_${colors[Math.floor(Math.random() * colors.length)]}_${number}`;
}

function severityForReason(reason: ReportReason): ReportSummary["severity"] {
  if (reason === "minor_safety") {
    return "critical";
  }
  if (reason === "violence" || reason === "sexual_content") {
    return "high";
  }
  if (reason === "harassment" || reason === "scam" || reason === "privacy") {
    return "medium";
  }
  return "low";
}

function maskEmail(email: string): string {
  const [name = "", domain = ""] = email.split("@");
  const safeName = name.length <= 2 ? `${name.slice(0, 1)}*` : `${name.slice(0, 2)}***`;
  return domain ? `${safeName}@${domain}` : safeName;
}

function formatViDateTime(value?: string): string {
  if (!value) {
    return "chưa xác định";
  }
  return new Date(value).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

export function safetyHash(value: string, secret = process.env.SAFETY_HASH_SECRET ?? "dev-change-me"): string {
  return createHmac("sha256", secret).update(value.trim().toLowerCase()).digest("hex");
}
