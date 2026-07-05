import { Inject, Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import {
  type AccountSummary,
  type AdminMetrics,
  type ChatProfile,
  type CreateAnonymousSessionResponse,
  type Gender,
  type PublicConversation,
  type PublicMessage,
  type PublicParticipant,
  type PublicRoom,
  type ReportReason,
  type ReportSummary,
  type StartMatchingResponse,
  defaultMatchingTopicId
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
  online: boolean;
  createdAt: string;
}

interface AccountRecord {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  role: "user" | "moderator" | "admin";
  profile: ChatProfile | null;
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
  type: "direct" | "room";
  topicId?: string;
  roomId?: string;
  status: "active" | "ended" | "locked";
  members: ConversationMemberRecord[];
  messages: PublicMessage[];
  startedAt: string;
  endedAt?: string;
  topicSuggestionEmitted: boolean;
}

interface MatchingRequestRecord {
  requestId: string;
  sessionId: string;
  topicId: string;
  desiredGenders: Gender[];
  strictGenderMatch: boolean;
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

const rooms: PublicRoom[] = [
  { id: "room_tam_su", slug: "tam-su", name: "Tâm sự", description: "Chia sẻ chuyện khó nói", onlineCount: 0, enabled: true },
  { id: "room_giai_tri", slug: "giai-tri", name: "Giải trí", description: "Nói chuyện vui, nhẹ nhàng", onlineCount: 0, enabled: true },
  { id: "room_hoc_tap", slug: "hoc-tap", name: "Học tập", description: "Hỏi bài, chia sẻ cách học", onlineCount: 0, enabled: true },
  { id: "room_hen_ho", slug: "hen-ho", name: "Hẹn hò", description: "Làm quen văn minh", onlineCount: 0, enabled: true },
  { id: "room_cong_nghe", slug: "cong-nghe", name: "Công nghệ", description: "Code, sản phẩm, công cụ mới", onlineCount: 0, enabled: true },
  { id: "room_dem_khuya", slug: "dem-khuya", name: "Đêm khuya", description: "Tâm sự khi khó ngủ", onlineCount: 0, enabled: true }
];

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
      online: false,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString()
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

    const account: AccountRecord = {
      id: makeId("acc"),
      email: normalized,
      passwordHash,
      displayName,
      role: normalized.endsWith("@admin.local") ? "admin" : "user",
      profile,
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
    const session: SessionRecord = {
      id: makeId("ses"),
      accountId: account.id,
      mode: "registered",
      role: account.role,
      baseAlias: account.displayName,
      avatarKey: randomAvatarKey(),
      profileComplete: Boolean(profile),
      status: "active",
      profile,
      online: false,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString()
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
      profileComplete: Boolean(account.profile)
    };
  }

  getSession(sessionId: string): SessionRecord {
    const session = this.sessions.get(sessionId);
    if (!session || session.status === "expired") {
      throw new AppException("SESSION_EXPIRED", "Phiên ẩn danh đã hết hạn", 401);
    }
    return session;
  }

  setOnline(sessionId: string, online: boolean): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.online = online;
    }
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
    topicId = defaultMatchingTopicId,
    desiredGenders?: Gender[],
    strictGenderMatch = true
  ): StartMatchingResponse {
    const session = this.getSession(sessionId);
    if (!session.profileComplete || !session.profile) {
      throw new AppException("PROFILE_REQUIRED", "Vui lòng hoàn tất hồ sơ trước khi tìm người lạ", 400);
    }
    if (this.matchingQueue.some((request) => request.sessionId === sessionId)) {
      throw new AppException("MATCHING_ALREADY_IN_QUEUE", "Bạn đang trong hàng chờ tìm người lạ", 409);
    }

    const currentRequest: MatchingRequestRecord = {
      requestId: makeId("match_req"),
      sessionId,
      topicId,
      desiredGenders: desiredGenders?.length ? desiredGenders : session.profile.desiredGenders,
      strictGenderMatch,
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
        topicId,
        timeoutSeconds: 60,
        avoidRecentMatches: true
      };
    }

    this.removeMatchingRequest(selected.requestId);
    const conversation = this.createDirectConversation(sessionId, selected.sessionId, topicId);
    this.matchHistory.add(pairKey(sessionId, selected.sessionId));
    this.events.emit("matching.paired", {
      conversationId: conversation.id,
      topicId,
      sessionIds: [sessionId, selected.sessionId]
    });

    return {
      requestId: currentRequest.requestId,
      status: "paired",
      topicId,
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

  shouldEmitTopicSuggestion(conversationId: string): boolean {
    const conversation = this.conversations.get(conversationId);
    if (!conversation || conversation.topicSuggestionEmitted || conversation.status !== "active") {
      return false;
    }
    return conversation.type === "direct" && conversation.messages.length >= 10;
  }

  markTopicSuggestionEmitted(conversationId: string): void {
    const conversation = this.conversations.get(conversationId);
    if (conversation) {
      conversation.topicSuggestionEmitted = true;
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

  listRooms(): PublicRoom[] {
    return rooms.map((room) => ({
      ...room,
      onlineCount: Array.from(this.conversations.values()).filter(
        (conversation) => conversation.roomId === room.id && conversation.status === "active"
      ).length
    }));
  }

  joinRoom(sessionId: string, roomId: string): { roomId: string; conversationId: string } {
    const room = rooms.find((item) => item.id === roomId || item.slug === roomId);
    if (!room || !room.enabled) {
      throw new AppException("ROOM_DISABLED", "Phòng này đang tạm đóng", 403);
    }
    const existing = Array.from(this.conversations.values()).find(
      (conversation) => conversation.type === "room" && conversation.roomId === room.id && conversation.status === "active"
    );
    const conversation = existing ?? this.createRoomConversation(room);
    if (!conversation.members.some((member) => member.sessionId === sessionId)) {
      conversation.members.push(this.createMember(sessionId));
    }
    return { roomId: room.id, conversationId: conversation.id };
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
    const target = targetParticipantId ? conversation.members.find((member) => member.id === targetParticipantId) : undefined;
    const report: ReportRecord = {
      id: makeId("rep"),
      reporterSessionId: sessionId,
      targetSessionId: target?.sessionId,
      conversationId,
      messageId,
      reason,
      note,
      status: "open",
      severity: reason === "minor_safety" || reason === "violence" ? "high" : "low",
      createdAt: new Date().toISOString()
    };
    this.reports.push(report);
    return report;
  }

  listReports(): ReportSummary[] {
    return [...this.reports].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  metrics(): AdminMetrics {
    return {
      onlineUsers: Array.from(this.sessions.values()).filter((session) => session.online).length,
      activeConversations: Array.from(this.conversations.values()).filter((conversation) => conversation.status === "active").length,
      messagesLastHour: Array.from(this.conversations.values()).reduce((sum, conversation) => {
        const hourAgo = Date.now() - 60 * 60 * 1000;
        return sum + conversation.messages.filter((message) => Date.parse(message.createdAt) >= hourAgo).length;
      }, 0),
      openReports: this.reports.filter((report) => report.status === "open").length
    };
  }

  private createDirectConversation(sessionAId: string, sessionBId: string, topicId: string): ConversationRecord {
    const conversation: ConversationRecord = {
      id: makeId("conv"),
      type: "direct",
      topicId,
      status: "active",
      members: [this.createMember(sessionAId), this.createMember(sessionBId)],
      messages: [],
      startedAt: new Date().toISOString(),
      topicSuggestionEmitted: false
    };
    this.conversations.set(conversation.id, conversation);
    return conversation;
  }

  private createRoomConversation(room: PublicRoom): ConversationRecord {
    const conversation: ConversationRecord = {
      id: `room_conv_${room.slug}`,
      type: "room",
      roomId: room.id,
      topicId: room.slug,
      status: "active",
      members: [],
      messages: [],
      startedAt: new Date().toISOString(),
      topicSuggestionEmitted: false
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
    const candidateProfile = this.getSession(candidate.sessionId).profile;
    if (!currentProfile || !candidateProfile) {
      return false;
    }
    const topicOk =
      current.topicId === candidate.topicId ||
      current.topicId === defaultMatchingTopicId ||
      candidate.topicId === defaultMatchingTopicId;
    const currentWantsCandidate = current.desiredGenders.includes(candidateProfile.gender);
    const candidateWantsCurrent = !current.strictGenderMatch || candidate.desiredGenders.includes(currentProfile.gender);
    return topicOk && currentWantsCandidate && candidateWantsCurrent;
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
    topicId: conversation.topicId,
    roomId: conversation.roomId,
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

export function safetyHash(value: string, secret = process.env.SAFETY_HASH_SECRET ?? "dev-change-me"): string {
  return createHmac("sha256", secret).update(value.trim().toLowerCase()).digest("hex");
}
