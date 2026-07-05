import { Body, Controller, Get, Inject, Post, Query, Req, Res, UseGuards } from "@nestjs/common";
import { loginSchema, ok, registerSchema, linkSessionSchema } from "@chatandanh/shared";
import { randomBytes } from "node:crypto";
import { Request, Response } from "express";
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
    const auth: AuthContext = {
      sessionId: session.id,
      accountId: account.id,
      mode: "registered",
      role: account.role
    };
    const accessToken = this.tokens.signAccessToken(auth);

    setRefreshCookie(response, this.tokens.signRefreshToken(auth));
    return ok({ account: this.store.toAccountSummary(account), accessToken });
  }

  @Post("login")
  async login(@Body() body: unknown, @Res({ passthrough: true }) response: Response) {
    const payload = loginSchema.parse(body);
    const account = this.store.findAccountByEmail(payload.email);
    if (!account || !account.passwordHash || !(await bcrypt.compare(payload.password, account.passwordHash))) {
      throw new AppException("UNAUTHORIZED", "Email hoặc mật khẩu chưa đúng", 401);
    }

    const session = this.store.createSessionForAccount(account);
    const auth: AuthContext = {
      sessionId: session.id,
      accountId: account.id,
      mode: "registered",
      role: account.role
    };
    const accessToken = this.tokens.signAccessToken(auth);
    setRefreshCookie(response, this.tokens.signRefreshToken(auth));
    return ok({ account: this.store.toAccountSummary(account), accessToken });
  }

  @Get("google")
  google(@Res() response: Response) {
    const config = getGoogleOAuthConfig();
    if (!config) {
      redirectToWeb(response, { authError: "Google OAuth chưa được cấu hình." });
      return;
    }

    const state = randomBytes(24).toString("hex");
    response.cookie(GOOGLE_STATE_COOKIE, state, googleStateCookieOptions());

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", config.clientId);
    authUrl.searchParams.set("redirect_uri", config.callbackUrl);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", "openid email profile");
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("prompt", "select_account");

    response.redirect(authUrl.toString());
  }

  @Get("google/callback")
  async googleCallback(
    @Query() query: Record<string, string | undefined>,
    @Req() request: Request,
    @Res() response: Response
  ) {
    const config = getGoogleOAuthConfig();
    response.clearCookie(GOOGLE_STATE_COOKIE, googleStateClearCookieOptions());

    if (!config) {
      redirectToWeb(response, { authError: "Google OAuth chưa được cấu hình." });
      return;
    }
    if (query.error) {
      redirectToWeb(response, { authError: "Bạn đã hủy hoặc Google từ chối đăng nhập." });
      return;
    }

    const expectedState = readCookie(request, GOOGLE_STATE_COOKIE);
    if (!query.code || !query.state || !expectedState || query.state !== expectedState) {
      redirectToWeb(response, { authError: "Phiên đăng nhập Google không hợp lệ, vui lòng thử lại." });
      return;
    }

    try {
      const googleProfile = await fetchGoogleProfile(query.code, config);
      const account = this.store.createOrFindGoogleAccount(googleProfile);
      const session = this.store.createSessionForAccount(account);
      const auth: AuthContext = {
        sessionId: session.id,
        accountId: account.id,
        mode: "registered",
        role: account.role
      };
      setRefreshCookie(response, this.tokens.signRefreshToken(auth));
      redirectToWeb(response, { auth: "google" });
    } catch {
      redirectToWeb(response, { authError: "Không đăng nhập được bằng Google. Vui lòng thử lại." });
    }
  }

  @Post("refresh")
  refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const refreshToken = readCookie(request, REFRESH_COOKIE);
    if (!refreshToken) {
      throw new AppException("UNAUTHORIZED", "Vui lòng đăng nhập lại", 401);
    }

    const auth = this.tokens.verifyRefreshToken(refreshToken);
    if (!auth.accountId) {
      throw new AppException("UNAUTHORIZED", "Vui lòng đăng nhập lại", 401);
    }
    const account = this.store.findAccountById(auth.accountId);
    if (!account) {
      throw new AppException("UNAUTHORIZED", "Tài khoản không còn hợp lệ", 401);
    }

    const session = this.store.ensureSessionForAccount(account, auth.sessionId);
    const nextAuth: AuthContext = {
      sessionId: session.id,
      accountId: account.id,
      mode: "registered",
      role: account.role
    };
    const accessToken = this.tokens.signAccessToken(nextAuth);
    setRefreshCookie(response, this.tokens.signRefreshToken(nextAuth));
    return ok({ account: this.store.toAccountSummary(account), accessToken });
  }

  @Post("logout")
  logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie(REFRESH_COOKIE, { path: "/" });
    return ok({ loggedOut: true });
  }

  @Post("link-session")
  @UseGuards(AccessTokenGuard)
  linkSession(@CurrentAuth() auth: AuthContext, @Body() body: unknown) {
    const payload = linkSessionSchema.parse(body);
    return ok({ linked: Boolean(auth.accountId), sessionId: payload.sessionId });
  }
}

const REFRESH_COOKIE = "refresh_token";
const GOOGLE_STATE_COOKIE = "google_oauth_state";

interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
}

interface GoogleTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface GoogleUserInfoResponse {
  sub?: string;
  email?: string;
  email_verified?: boolean | string;
  name?: string;
}

function setRefreshCookie(response: Response, token: string) {
  response.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
    maxAge: Number(process.env.REFRESH_TOKEN_EXPIRES_DAYS ?? 30) * 24 * 60 * 60 * 1000,
    path: "/"
  });
}

function googleStateCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.COOKIE_SECURE === "true",
    maxAge: 10 * 60 * 1000,
    path: "/api/auth/google"
  };
}

function googleStateClearCookieOptions() {
  return {
    path: "/api/auth/google"
  };
}

function getGoogleOAuthConfig(): GoogleOAuthConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const callbackUrl = process.env.GOOGLE_CALLBACK_URL ?? "http://localhost:3000/api/auth/google/callback";

  if (!clientId || !clientSecret || !callbackUrl) {
    return null;
  }

  return { clientId, clientSecret, callbackUrl };
}

async function fetchGoogleProfile(code: string, config: GoogleOAuthConfig) {
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.callbackUrl,
      grant_type: "authorization_code"
    })
  });
  const tokenPayload = (await tokenResponse.json()) as GoogleTokenResponse;
  if (!tokenResponse.ok || !tokenPayload.access_token) {
    throw new Error(tokenPayload.error_description ?? tokenPayload.error ?? "Google token exchange failed");
  }

  const profileResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${tokenPayload.access_token}` }
  });
  const profile = (await profileResponse.json()) as GoogleUserInfoResponse;
  const emailVerified = profile.email_verified === true || profile.email_verified === "true";
  if (!profileResponse.ok || !profile.sub || !profile.email || !emailVerified) {
    throw new Error("Google profile is missing verified email");
  }

  return {
    googleSub: profile.sub,
    email: profile.email,
    displayName: normalizeDisplayName(profile.name, profile.email)
  };
}

function normalizeDisplayName(name: string | undefined, email: string): string {
  const fallback = email.split("@")[0] || "Bạn mới";
  return (name?.trim() || fallback).slice(0, 30);
}

function redirectToWeb(response: Response, params: Record<string, string>) {
  const webUrl = new URL(process.env.WEB_ORIGIN ?? "http://localhost:5173");
  for (const [key, value] of Object.entries(params)) {
    webUrl.searchParams.set(key, value);
  }
  response.redirect(webUrl.toString());
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.cookie;
  if (!header) {
    return null;
  }

  for (const part of header.split(";")) {
    const [rawKey, ...rawValue] = part.trim().split("=");
    if (rawKey === name) {
      return decodeURIComponent(rawValue.join("="));
    }
  }
  return null;
}
