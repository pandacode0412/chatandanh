import { EventEmitter2 } from "@nestjs/event-emitter";
import { describe, expect, it } from "vitest";
import { StoreService } from "../src/modules/common/store.service";

function createStore() {
  return new StoreService(new EventEmitter2());
}

describe("StoreService Google accounts", () => {
  it("creates a Google account without exposing Google identifiers in account summary", () => {
    const store = createStore();
    const account = store.createOrFindGoogleAccount({
      googleSub: "google-sub-1",
      email: "User@Example.com",
      displayName: "Mây Google"
    });

    const summary = store.toAccountSummary(account) as Record<string, unknown>;

    expect(summary.email).toBe("user@example.com");
    expect(summary.displayName).toBe("Mây Google");
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
