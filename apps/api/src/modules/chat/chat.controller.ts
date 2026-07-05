import { Body, Controller, Get, Inject, Param, Post, Query, UseGuards } from "@nestjs/common";
import { endConversationSchema, engagementEventSchema, ok } from "@chatandanh/shared";
import { AccessTokenGuard } from "../../common/access-token.guard";
import { CurrentAuth, type AuthContext } from "../../common/current-auth";
import { StoreService } from "../common/store.service";

@Controller("conversations")
@UseGuards(AccessTokenGuard)
export class ChatController {
  constructor(@Inject(StoreService) private readonly store: StoreService) {}

  @Get(":conversationId")
  getConversation(@CurrentAuth() auth: AuthContext, @Param("conversationId") conversationId: string) {
    return ok(this.store.getPublicConversation(conversationId, auth.sessionId));
  }

  @Get(":conversationId/messages")
  getMessages(
    @CurrentAuth() auth: AuthContext,
    @Param("conversationId") conversationId: string,
    @Query("limit") limit?: string
  ) {
    return ok({ items: this.store.getMessages(conversationId, auth.sessionId, Number(limit ?? 30)), nextCursor: null });
  }

  @Post(":conversationId/end")
  end(@CurrentAuth() auth: AuthContext, @Param("conversationId") conversationId: string, @Body() body: unknown) {
    const payload = endConversationSchema.parse({ conversationId, ...(typeof body === "object" && body ? body : {}) });
    const result = this.store.endConversation(auth.sessionId, conversationId, payload.reason);
    return ok({ conversationId, reason: payload.reason, ...result });
  }

  @Post(":conversationId/engagement-events")
  engagement(@CurrentAuth() auth: AuthContext, @Param("conversationId") conversationId: string, @Body() body: unknown) {
    const payload = engagementEventSchema.parse(body);
    this.store.getConversationForSession(conversationId, auth.sessionId);
    return ok({ conversationId, accepted: true, event: payload });
  }
}
