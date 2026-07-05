import { Body, Controller, Delete, Get, Inject, Param, Post, UseGuards } from "@nestjs/common";
import { blockRequestSchema, ok, reportRequestSchema } from "@chatandanh/shared";
import { AccessTokenGuard } from "../../common/access-token.guard";
import { CurrentAuth, type AuthContext } from "../../common/current-auth";
import { StoreService } from "../common/store.service";

@Controller()
@UseGuards(AccessTokenGuard)
export class ReportsController {
  constructor(@Inject(StoreService) private readonly store: StoreService) {}

  @Post("blocks")
  block(@CurrentAuth() auth: AuthContext, @Body() body: unknown) {
    const payload = blockRequestSchema.parse(body);
    this.store.block(auth.sessionId, payload.conversationId, payload.targetParticipantId, payload.reason);
    return ok({ blocked: true });
  }

  @Get("blocks")
  blocks() {
    return ok({ items: [] });
  }

  @Delete("blocks/:blockId")
  unblock(@Param("blockId") blockId: string) {
    return ok({ blockId, removed: true });
  }

  @Post("reports")
  report(@CurrentAuth() auth: AuthContext, @Body() body: unknown) {
    const payload = reportRequestSchema.parse(body);
    const report = this.store.report(
      auth.sessionId,
      payload.conversationId,
      payload.reason,
      payload.note,
      payload.messageId,
      payload.targetParticipantId
    );
    return ok({ reportId: report.id, status: "submitted" });
  }
}
