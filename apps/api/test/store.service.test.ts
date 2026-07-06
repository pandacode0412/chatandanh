import { EventEmitter2 } from "@nestjs/event-emitter";
import { describe, expect, it } from "vitest";
import type { ChatProfile } from "@chatandanh/shared";
import { StoreService } from "../src/modules/common/store.service";

function createStore() {
  return new StoreService(new EventEmitter2());
}

describe("StoreService Google accounts", () => {
  it("creates an email account with a generated public code when no display name is provided", () => {
    const store = createStore();
    const account = store.createAccount("email@example.com", "password-hash");

    expect(account.displayName).toMatch(/^AD-\d{4}$/);
    expect(account.profile).toBeNull();
  });

  it("creates a Google account without exposing Google identifiers in account summary", () => {
    const store = createStore();
    const account = store.createOrFindGoogleAccount({
      googleSub: "google-sub-1",
      email: "User@Example.com",
      displayName: "AD-2048"
    });

    const summary = store.toAccountSummary(account) as Record<string, unknown>;

    expect(summary.email).toBe("user@example.com");
    expect(summary.displayName).toBe("AD-2048");
    expect(summary.profileComplete).toBe(false);
    expect(summary).not.toHaveProperty("googleSub");
    expect(summary).not.toHaveProperty("authProvider");
  });

  it("links a Google identity to an existing email account with the same verified email", () => {
    const store = createStore();
    const emailAccount = store.createAccount("same@example.com", "password-hash", "Email User", null);

    const googleAccount = store.createOrFindGoogleAccount({
      googleSub: "google-sub-2",
      email: "same@example.com",
      displayName: "Google User"
    });

    expect(googleAccount.id).toBe(emailAccount.id);
    expect(store.findAccountByGoogleSub("google-sub-2")?.id).toBe(emailAccount.id);
  });
});

describe("StoreService chat messages", () => {
  it("stores an image attachment message without requiring text", () => {
    const store = createStore();
    const profileA: ChatProfile = {
      displayName: "AD-1001",
      age: 22,
      location: "TP. Hồ Chí Minh",
      gender: "female",
      desiredGenders: ["male", "female", "other"]
    };
    const profileB: ChatProfile = {
      displayName: "AD-1002",
      age: 23,
      location: "Hà Nội",
      gender: "male",
      desiredGenders: ["male", "female", "other"]
    };
    const sessionA = store.createAnonymousSession(profileA);
    const sessionB = store.createAnonymousSession(profileB);
    store.startMatching(sessionA.sessionId);
    const match = store.startMatching(sessionB.sessionId);
    const attachment = {
      type: "image" as const,
      url: "data:image/png;base64,aGVsbG8=",
      mimeType: "image/png" as const,
      name: "anh.png",
      size: 12,
      alt: "Ảnh anh.png"
    };

    const message = store.sendMessage(sessionA.sessionId, match.conversationId!, "", "client-image-1", attachment);

    expect(message.body).toBe("");
    expect(message.attachment).toEqual(attachment);
    expect(store.getMessages(match.conversationId!, sessionB.sessionId)).toContainEqual(message);
  });
});
