import type {
  AuthResponse,
  ApiEnvelope,
  ChatProfile,
  CreateAnonymousSessionResponse,
  LoginRequest,
  PublicConversation,
  PublicMessage,
  PublicRoom,
  RegisterRequest,
  ReportReason,
  StartMatchingResponse
} from "@chatandanh/shared";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export function apiBaseUrl() {
  return API_URL;
}

export async function apiRequest<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${API_URL}/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    },
    credentials: "include"
  });
  const envelope = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || envelope.error) {
    throw new Error(envelope.error?.message ?? "Có lỗi xảy ra");
  }
  return envelope.data as T;
}

export function createAnonymousSession(profile?: ChatProfile) {
  return apiRequest<CreateAnonymousSessionResponse>("/sessions/anonymous", {
    method: "POST",
    body: JSON.stringify({ profile, ageConfirmed: true })
  });
}

export function registerWithEmail(body: RegisterRequest) {
  return apiRequest<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(body)
  });
}

export function loginWithEmail(body: LoginRequest) {
  return apiRequest<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(body)
  });
}

export function logoutSession() {
  return apiRequest<{ loggedOut: boolean }>("/auth/logout", { method: "POST" });
}

export function getProfile(token: string) {
  return apiRequest<{ profileComplete: boolean; profile: ChatProfile | null }>("/me/profile", {}, token);
}

export function updateProfile(token: string, profile: ChatProfile) {
  return apiRequest<{ profileComplete: boolean; profile: ChatProfile }>("/me/profile", {
    method: "PUT",
    body: JSON.stringify(profile)
  }, token);
}

export function startMatching(token: string, desiredGenders: ChatProfile["desiredGenders"]) {
  return apiRequest<StartMatchingResponse>("/matching/start", {
    method: "POST",
    body: JSON.stringify({ mode: "direct", preferences: { desiredGenders, strictGenderMatch: true } })
  }, token);
}

export function listRooms() {
  return apiRequest<{ items: PublicRoom[] }>("/rooms");
}

export function getConversation(token: string, conversationId: string) {
  return apiRequest<PublicConversation>(`/conversations/${conversationId}`, {}, token);
}

export function getMessages(token: string, conversationId: string) {
  return apiRequest<{ items: PublicMessage[]; nextCursor: string | null }>(
    `/conversations/${conversationId}/messages`,
    {},
    token
  );
}

export function reportConversation(
  token: string,
  body: { conversationId: string; targetParticipantId?: string; messageId?: string; reason: ReportReason; note?: string }
) {
  return apiRequest<{ reportId: string; status: string }>("/reports", {
    method: "POST",
    body: JSON.stringify(body)
  }, token);
}

export function blockParticipant(token: string, body: { conversationId: string; targetParticipantId: string; reason?: string }) {
  return apiRequest<{ blocked: boolean }>("/blocks", {
    method: "POST",
    body: JSON.stringify(body)
  }, token);
}

export function getAdminMetrics(token: string) {
  return apiRequest<{ onlineUsers: number; activeConversations: number; messagesLastHour: number; openReports: number }>(
    "/admin/metrics",
    {},
    token
  );
}
