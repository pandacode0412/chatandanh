import { Body, Controller, Get, Inject, Post, UseGuards } from "@nestjs/common";
import { moderationActionSchema, ok } from "@chatandanh/shared";
import { AccessTokenGuard } from "../../common/access-token.guard";
import { CurrentAuth, type AuthContext } from "../../common/current-auth";
import { AppException } from "../../common/app-exception";
import { StoreService } from "../common/store.service";

@Controller("admin")
@UseGuards(AccessTokenGuard)
export class AdminController {
  constructor(@Inject(StoreService) private readonly store: StoreService) {}

  @Get("reports")
  reports(@CurrentAuth() auth: AuthContext) {
    requireModerator(auth);
    return ok({ items: this.store.listReports() });
  }

  @Post("moderation-actions")
  moderationAction(@CurrentAuth() auth: AuthContext, @Body() body: unknown) {
    requireModerator(auth);
    const payload = moderationActionSchema.parse(body);
    return ok({ accepted: true, action: payload.action, createdAt: new Date().toISOString() });
  }

  @Get("metrics")
  metrics(@CurrentAuth() auth: AuthContext) {
    requireModerator(auth);
    return ok(this.store.metrics());
  }
}

function requireModerator(auth: AuthContext) {
  if (auth.role !== "admin" && auth.role !== "moderator") {
    throw new AppException("FORBIDDEN", "Bạn không có quyền truy cập khu vực quản trị", 403);
  }
}
