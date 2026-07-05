import { Inject, Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { AppException } from "../../common/app-exception";
import type { AuthContext } from "../../common/current-auth";

@Injectable()
export class TokenService {
  constructor(@Inject(JwtService) private readonly jwtService: JwtService) {}

  signAccessToken(auth: AuthContext): string {
    return this.jwtService.sign(auth, { subject: auth.sessionId });
  }

  verifyAccessToken(token: string): AuthContext {
    try {
      const payload = this.jwtService.verify<AuthContext>(token);
      if (!payload.sessionId) {
        throw new Error("Missing sessionId");
      }
      return payload;
    } catch {
      throw new AppException("UNAUTHORIZED", "Phiên đăng nhập không hợp lệ hoặc đã hết hạn", 401);
    }
  }
}
