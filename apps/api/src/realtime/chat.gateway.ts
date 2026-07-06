import { Inject } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer
} from "@nestjs/websockets";
import { OnEvent } from "@nestjs/event-emitter";
import { conversationIdSchema, endConversationSchema, sendMessageSchema } from "@chatandanh/shared";
import type { Server, Socket } from "socket.io";
import type { AuthContext } from "../common/current-auth";
import { StoreService } from "../modules/common/store.service";
import { TokenService } from "../modules/common/token.service";

type AuthedSocket = Socket & { data: { auth?: AuthContext } };

@WebSocketGateway({
  cors: {
    origin: process.env.WEB_ORIGIN ?? "http://localhost:5173",
    credentials: true
  }
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    @Inject(StoreService) private readonly store: StoreService,
    @Inject(TokenService) private readonly tokens: TokenService
  ) {}

  handleConnection(client: AuthedSocket) {
    try {
      const token = client.handshake.auth?.token;
      if (typeof token !== "string") {
        client.disconnect(true);
        return;
      }
      const auth = this.tokens.verifyAccessToken(token);
      client.data.auth = auth;
      client.join(sessionRoom(auth.sessionId));
      this.store.setOnline(auth.sessionId, true);
      client.emit("socket:ready", { sessionId: auth.sessionId, socketId: client.id, online: true });
      this.broadcastOnlineCount();
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: AuthedSocket) {
    const sessionId = client.data.auth?.sessionId;
    if (sessionId) {
      this.store.setOnline(sessionId, false);
      this.broadcastOnlineCount();
    }
  }

  private broadcastOnlineCount() {
    try {
      const count = this.store.getOnlineCount();
      this.server.emit("stats:online", { count });
    } catch {
      // ignore
    }
  }

  @SubscribeMessage("conversation:join")
  joinConversation(@ConnectedSocket() client: AuthedSocket, @MessageBody() body: unknown) {
    const auth = requireAuth(client);
    const payload = conversationIdSchema.parse(body);
    this.store.getConversationForSession(payload.conversationId, auth.sessionId);
    client.join(conversationRoom(payload.conversationId));
  }

  @SubscribeMessage("message:send")
  sendMessage(@ConnectedSocket() client: AuthedSocket, @MessageBody() body: unknown) {
    const auth = requireAuth(client);
    try {
      const payload = sendMessageSchema.parse(body);
      client.join(conversationRoom(payload.conversationId));
      const message = this.store.sendMessage(auth.sessionId, payload.conversationId, payload.body, payload.clientMessageId, payload.attachment);
      this.server.to(conversationRoom(payload.conversationId)).emit("message:new", message);

      if (this.store.shouldEmitQuestionSuggestion(payload.conversationId)) {
        this.store.markQuestionSuggestionEmitted(payload.conversationId);
        this.server.to(conversationRoom(payload.conversationId)).emit("engagement:milestone", {
          conversationId: payload.conversationId,
          milestone: "question_suggestion",
          title: "Hai bạn nói chuyện khá hợp đó",
          suggestions: [
            "Một điều nhỏ gần đây làm bạn vui là gì?",
            "Bạn thích nói chuyện nghiêm túc hay vui vui hơn?",
            "Nếu tối nay được đi đâu đó ngay, bạn muốn đi đâu?"
          ]
        });
      }
    } catch (error) {
      client.emit("moderation:warning", { message: error instanceof Error ? error.message : "Không gửi được tin nhắn", code: "VALIDATION_ERROR" });
    }
  }

  @SubscribeMessage("typing:start")
  typingStart(@ConnectedSocket() client: AuthedSocket, @MessageBody() body: unknown) {
    this.emitTyping(client, body, true);
  }

  @SubscribeMessage("typing:stop")
  typingStop(@ConnectedSocket() client: AuthedSocket, @MessageBody() body: unknown) {
    this.emitTyping(client, body, false);
  }

  @SubscribeMessage("conversation:end")
  endConversation(@ConnectedSocket() client: AuthedSocket, @MessageBody() body: unknown) {
    const auth = requireAuth(client);
    const payload = endConversationSchema.parse(body);
    if (!payload.conversationId) {
      return;
    }
    const result = this.store.endConversation(auth.sessionId, payload.conversationId, payload.reason);
    this.server.to(conversationRoom(payload.conversationId)).emit("conversation:ended", {
      conversationId: payload.conversationId,
      reason: payload.reason,
      ...result
    });
  }

  @OnEvent("matching.paired")
  emitMatched(payload: { conversationId: string; sessionIds: [string, string] }) {
    const [sessionA, sessionB] = payload.sessionIds;
    this.server.to(sessionRoom(sessionA)).emit("matching:paired", {
      conversationId: payload.conversationId,
      participant: this.store.getOtherParticipant(payload.conversationId, sessionA)
    });
    this.server.to(sessionRoom(sessionB)).emit("matching:paired", {
      conversationId: payload.conversationId,
      participant: this.store.getOtherParticipant(payload.conversationId, sessionB)
    });
  }

  private emitTyping(client: AuthedSocket, body: unknown, typing: boolean) {
    const auth = requireAuth(client);
    const payload = conversationIdSchema.parse(body);
    const participantId = this.store.getSelfParticipantId(payload.conversationId, auth.sessionId);
    client.to(conversationRoom(payload.conversationId)).emit("typing:update", {
      conversationId: payload.conversationId,
      participantId,
      typing
    });
  }
}

function requireAuth(client: AuthedSocket): AuthContext {
  if (!client.data.auth) {
    client.disconnect(true);
    throw new Error("Socket chưa xác thực");
  }
  return client.data.auth;
}

function sessionRoom(sessionId: string): string {
  return `session:${sessionId}`;
}

function conversationRoom(conversationId: string): string {
  return `conversation:${conversationId}`;
}
