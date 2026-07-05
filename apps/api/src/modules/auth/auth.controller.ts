import { Body, Controller, Get, Inject, Post, Res, UseGuards } from "@nestjs/common";
import { loginSchema, ok, registerSchema, linkSessionSchema } from "@chatandanh/shared";
import { Response } from "express";
import * as bcrypt from "bcryptjs";
import { AccessTokenGuard } from "../../common/access-token.guard";
import { CurrentAuth, type AuthContext } from "../../common/current-auth";
import { AppException } from "../../common/app-exception";
import { StoreService } from "../common/store.service";
import { TokenService } from "../common/token.service";

@Controller("auth")
export class AuthController {
  constructor(
    @Inject(StoreService) private readonly store: StoreService,
    @Inject(TokenService) private readonly tokens: TokenService
  ) {}

  @Post("register")
  async register(@Body() body: unknown, @Res({ passthrough: true }) response: Response) {
    const payload = registerSchema.parse(body);
    const passwordHash = await bcrypt.hash(payload.password, 10);
    const profile = payload.profile ? { displayName: payload.displayName, ...payload.profile } : null;
    const account = this.store.createAccount(payload.email, passwordHash, payload.displayName, profile);
    const session = this.store.createSessionForAccount(account);
    const accessToken = this.tokens.signAccessToken({
      sessionId: session.id,
      accountId: account.id,
      mode: "registered",
      role: account.role
    });

    setRefreshCookie(response, accessToken);
    return ok({ account: this.store.toAccountSummary(account), accessToken });
  }

  @Post("login")
  async login(@Body() body: unknown, @Res({ passthrough: true }) response: Response) {
    const payload = loginSchema.parse(body);
    const account = this.store.findAccountByEmail(payload.email);
    if (!account || !(await bcrypt.compare(payload.password, account.passwordHash))) {
      throw new AppException("UNAUTHORIZED", "Email hoặc mật khẩu chưa đúng", 401);
    }

    const session = this.store.createSessionForAccount(account);
    const accessToken = this.tokens.signAccessToken({
      sessionId: session.id,
      accountId: account.id,
      mode: "registered",
      role: account.role
    });
    setRefreshCookie(response, accessToken);
    return ok({ account: this.store.toAccountSummary(account), accessToken });
  }

  @Get("google")
  google() {
    return ok({
      message: "Google OAuth sẽ được cấu hình bằng GOOGLE_CLIENT_ID và GOOGLE_CLIENT_SECRET.",
      enabled: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
    });
  }

  @Get("google/callback")
  googleCallback() {
    return ok({ message: "Google callback placeholder cho MVP scaffold." });
  }

  @Post("refresh")
  refresh() {
    return ok({ message: "Refresh token rotation sẽ được nối với bảng refresh_tokens khi bật persistence." });
  }

  @Post("logout")
  logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie("refresh_token");
    return ok({ loggedOut: true });
  }

  @Post("link-session")
  @UseGuards(AccessTokenGuard)
  linkSession(@CurrentAuth() auth: AuthContext, @Body() body: unknown) {
    const payload = linkSessionSchema.parse(body);
    return ok({ linked: Boolean(auth.accountId), sessionId: payload.sessionId });
  }
}

function setRefreshCookie(response: Response, token: string) {
  response.cookie("refresh_token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
    maxAge: Number(process.env.REFRESH_TOKEN_EXPIRES_DAYS ?? 30) * 24 * 60 * 60 * 1000
  });
}
