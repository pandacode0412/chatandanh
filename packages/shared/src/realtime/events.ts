import type { PublicParticipant, PublicMessage, SendMessagePayload } from "../chat/chat.schema";

export interface SocketReadyPayload {
  sessionId: string;
  socketId: string;
  online: true;
}

export interface MatchingPairedPayload {
  conversationId: string;
  participant: PublicParticipant;
}

export interface MatchingTimeoutPayload {
  requestId: string;
  message: string;
}

export interface TypingUpdatePayload {
  conversationId: string;
  participantId: string;
  typing: boolean;
}

export interface ConversationEndedPayload {
  conversationId: string;
  reason: string;
  endedBy: string;
  endedAt: string;
}

export interface EngagementMilestonePayload {
  conversationId: string;
  milestone: "question_suggestion";
  title: string;
  suggestions: string[];
}

export interface ServerToClientEvents {
  "socket:ready": (payload: SocketReadyPayload) => void;
  "matching:paired": (payload: MatchingPairedPayload) => void;
  "matching:timeout": (payload: MatchingTimeoutPayload) => void;
  "message:new": (payload: PublicMessage) => void;
  "typing:update": (payload: TypingUpdatePayload) => void;
  "conversation:ended": (payload: ConversationEndedPayload) => void;
  "moderation:warning": (payload: { message: string; code: string }) => void;
  "engagement:milestone": (payload: EngagementMilestonePayload) => void;
}

export interface ClientToServerEvents {
  "conversation:join": (payload: { conversationId: string }) => void;
  "message:send": (payload: SendMessagePayload) => void;
  "typing:start": (payload: { conversationId: string }) => void;
  "typing:stop": (payload: { conversationId: string }) => void;
  "conversation:end": (payload: { conversationId: string; reason?: string }) => void;
}
