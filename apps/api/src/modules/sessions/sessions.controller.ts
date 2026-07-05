import { Body, Controller, HttpStatus, Inject, Post } from "@nestjs/common";
import { createAnonymousSessionSchema, ok } from "@chatandanh/shared";
import { AppException } from "../../common/app-exception";
import { StoreService } from "../common/store.service";
import { TokenService } from "../common/token.service";

@Controller("sessions")
export class SessionsController {
  constructor(
    @Inject(StoreService) private readonly store: StoreService,
    @Inject(TokenService) private readonly tokens: TokenService
  ) {}

  @Post("anonymous")
  createAnonymous(@Body() body: unknown) {
    const payload = createAnonymousSessionSchema.parse(body);
    if (!payload.ageConfirmed) {
      throw new AppException("FORBIDDEN", "Bạn cần xác nhận đủ tuổi để tiếp tục", HttpStatus.FORBIDDEN);
    }

    const session = this.store.createAnonymousSession(payload.profile, payload.preferredAlias);
    const accessToken = this.tokens.signAccessToken({ sessionId: session.sessionId, mode: "guest", role: "user" });
    return ok({ ...session, accessToken });
  }
}
