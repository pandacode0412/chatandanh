import { Body, Controller, Get, Inject, Post, Query, UseGuards } from "@nestjs/common";
import { moderationActionSchema, ok, reportReasons, type ReportReason, type ReportSummary } from "@chatandanh/shared";
import { AccessTokenGuard } from "../../common/access-token.guard";
import { CurrentAuth, type AuthContext } from "../../common/current-auth";
import { AppException } from "../../common/app-exception";
import { StoreService } from "../common/store.service";

@Controller("admin")
@UseGuards(AccessTokenGuard)
export class AdminController {
  constructor(@Inject(StoreService) private readonly store: StoreService) {}

  @Get("overview")
  overview(@CurrentAuth() auth: AuthContext) {
    requireModerator(auth);
    return ok(this.store.adminOverview());
  }

  @Get("reports")
  reports(
    @CurrentAuth() auth: AuthContext,
    @Query("status") status?: ReportSummary["status"],
    @Query("reason") reason?: ReportReason,
    @Query("limit") limit?: string
  ) {
    requireModerator(auth);
    const safeStatus = isReportStatus(status) ? status : undefined;
    const safeReason = isReportReason(reason) ? reason : undefined;
    return ok({ items: this.store.listReports({ status: safeStatus, reason: safeReason, limit: limit ? Number(limit) : undefined }) });
  }

  @Get("users")
  users(@CurrentAuth() auth: AuthContext, @Query("limit") limit?: string) {
    requireModerator(auth);
    return ok({ items: this.store.listAdminUsers(limit ? Number(limit) : undefined) });
  }

  @Post("moderation-actions")
  moderationAction(@CurrentAuth() auth: AuthContext, @Body() body: unknown) {
    requireModerator(auth);
    const payload = moderationActionSchema.parse(body);
    return ok({ accepted: true, action: this.store.applyModerationAction(auth.sessionId, payload) });
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

function isReportReason(value: unknown): value is ReportReason {
  return typeof value === "string" && reportReasons.includes(value as ReportReason);
}

function isReportStatus(value: unknown): value is ReportSummary["status"] {
  return value === "open" || value === "reviewing" || value === "resolved" || value === "dismissed";
}
