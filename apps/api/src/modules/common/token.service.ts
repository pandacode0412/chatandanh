import { Inject, Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { AppException } from "../../common/app-exception";
import type { AuthContext } from "../../common/current-auth";

type SignedAuthContext = AuthContext & { tokenType?: "access" | "refresh" };

@Injectable()
export class TokenService {
  constructor(@Inject(JwtService) private readonly jwtService: JwtService) {}

  signAccessToken(auth: AuthContext): string {
    return this.jwtService.sign({ ...auth, tokenType: "access" }, { subject: auth.sessionId });
  }

  signRefreshToken(auth: AuthContext): string {
    const expiresInDays = Number(process.env.REFRESH_TOKEN_EXPIRES_DAYS ?? 30);
    return this.jwtService.sign(
      { ...auth, tokenType: "refresh" },
      {
        subject: auth.sessionId,
        secret: process.env.REFRESH_TOKEN_SECRET ?? "dev-change-me",
        expiresIn: `${expiresInDays}d` as never
      }
    );
  }

  verifyAccessToken(token: string): AuthContext {
    try {
      const payload = this.jwtService.verify<SignedAuthContext>(token);
      if (!payload.sessionId || payload.tokenType !== "access") {
        throw new Error("Invalid access token");
      }
      return toAuthContext(payload);
    } catch {
      throw new AppException("UNAUTHORIZED", "Phiên đăng nhập không hợp lệ hoặc đã hết hạn", 401);
    }
  }

  verifyRefreshToken(token: string): AuthContext {
    try {
      const payload = this.jwtService.verify<SignedAuthContext>(token, {
        secret: process.env.REFRESH_TOKEN_SECRET ?? "dev-change-me"
      });
      if (!payload.sessionId || payload.tokenType !== "refresh") {
        throw new Error("Invalid refresh token");
      }
      return toAuthContext(payload);
    } catch {
      throw new AppException("UNAUTHORIZED", "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại", 401);
    }
  }
}

function toAuthContext(payload: SignedAuthContext): AuthContext {
  return {
    sessionId: payload.sessionId,
    accountId: payload.accountId,
    mode: payload.mode,
    role: payload.role
  };
}
