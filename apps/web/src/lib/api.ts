import type {
  AdminOverview,
  AdminReportSummary,
  AdminUserSummary,
  AuthResponse,
  ApiEnvelope,
  ChatProfile,
  CreateAnonymousSessionResponse,
  LoginRequest,
  ModerationAction,
  ModerationActionSummary,
  PublicConversation,
  PublicMessage,
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

export function startMatching(
  token: string,
  preferences?: {
    desiredGenders?: ChatProfile["desiredGenders"];
    strictGenderMatch?: boolean;
    enableAgeFilter?: boolean;
    ageRange?: { min?: number; max?: number };
    enableGenderFilter?: boolean;
    enableLocationFilter?: boolean;
    desiredLocations?: string[];
  }
) {
  return apiRequest<StartMatchingResponse>("/matching/start", {
    method: "POST",
    body: JSON.stringify({ mode: "direct", preferences })
  }, token);
}

export function cancelMatching(token: string, requestId: string) {
  return apiRequest<{ status: string }>("/matching/cancel", {
    method: "POST",
    body: JSON.stringify({ requestId })
  }, token);
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
  return apiRequest<AdminOverview["metrics"]>("/admin/metrics", {}, token);
}

export function getAdminOverview(token: string) {
  return apiRequest<AdminOverview>("/admin/overview", {}, token);
}

export function getAdminReports(token: string) {
  return apiRequest<{ items: AdminReportSummary[] }>("/admin/reports?limit=80", {}, token);
}

export function getAdminUsers(token: string) {
  return apiRequest<{ items: AdminUserSummary[] }>("/admin/users?limit=120", {}, token);
}

export function createModerationAction(
  token: string,
  body: { reportId?: string; targetSessionId?: string; action: ModerationAction; durationMinutes?: number; note?: string }
) {
  return apiRequest<{ accepted: boolean; action: ModerationActionSummary }>("/admin/moderation-actions", {
    method: "POST",
    body: JSON.stringify(body)
  }, token);
}
