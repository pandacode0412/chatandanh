import { create } from "zustand";
import type { ChatProfile, EngagementMilestonePayload, PublicMessage, PublicParticipant } from "@chatandanh/shared";

interface SessionState {
  accessToken: string | null;
  displayAlias: string | null;
  avatarKey: string | null;
  role: "user" | "moderator" | "admin";
  profile: ChatProfile | null;
  conversationId: string | null;
  participant: PublicParticipant | null;
  messages: PublicMessage[];
  milestone: EngagementMilestonePayload | null;
  setSession: (payload: {
    accessToken: string;
    displayAlias: string;
    avatarKey: string;
    role?: "user" | "moderator" | "admin";
    profile?: ChatProfile | null;
  }) => void;
  setProfile: (profile: ChatProfile) => void;
  setConversation: (conversationId: string, participant: PublicParticipant) => void;
  addMessage: (message: PublicMessage) => void;
  setMessages: (messages: PublicMessage[]) => void;
  setMilestone: (milestone: EngagementMilestonePayload | null) => void;
  resetConversation: () => void;
  clearSession: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  accessToken: localStorage.getItem("chatandanh.accessToken"),
  displayAlias: localStorage.getItem("chatandanh.displayAlias"),
  avatarKey: localStorage.getItem("chatandanh.avatarKey"),
  role: (localStorage.getItem("chatandanh.role") as SessionState["role"] | null) ?? "user",
  profile: null,
  conversationId: null,
  participant: null,
  messages: [],
  milestone: null,
  setSession: (payload) => {
    localStorage.setItem("chatandanh.accessToken", payload.accessToken);
    localStorage.setItem("chatandanh.displayAlias", payload.displayAlias);
    localStorage.setItem("chatandanh.avatarKey", payload.avatarKey);
    localStorage.setItem("chatandanh.role", payload.role ?? "user");
    set({ ...payload, role: payload.role ?? "user", profile: payload.profile ?? null });
  },
  setProfile: (profile) => set({ profile }),
  setConversation: (conversationId, participant) => set({ conversationId, participant, messages: [], milestone: null }),
  addMessage: (message) =>
    set((state) => {
      if (message.clientMessageId && state.messages.some((item) => item.clientMessageId === message.clientMessageId)) {
        return state;
      }
      if (state.messages.some((item) => item.id === message.id)) {
        return state;
      }
      return { messages: [...state.messages, message] };
    }),
  setMessages: (messages) => set({ messages }),
  setMilestone: (milestone) => set({ milestone }),
  resetConversation: () => set({ conversationId: null, participant: null, messages: [], milestone: null }),
  clearSession: () => {
    localStorage.removeItem("chatandanh.accessToken");
    localStorage.removeItem("chatandanh.displayAlias");
    localStorage.removeItem("chatandanh.avatarKey");
    localStorage.removeItem("chatandanh.role");
    set({
      accessToken: null,
      displayAlias: null,
      avatarKey: null,
      role: "user",
      profile: null,
      conversationId: null,
      participant: null,
      messages: [],
      milestone: null
    });
  }
}));
