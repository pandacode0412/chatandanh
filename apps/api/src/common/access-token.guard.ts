import { CanActivate, ExecutionContext, Inject, Injectable } from "@nestjs/common";
import { AppException } from "./app-exception";
import { TokenService } from "../modules/common/token.service";

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(@Inject(TokenService) private readonly tokenService: TokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const header = request.headers.authorization;
    const token = typeof header === "string" && header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      throw new AppException("UNAUTHORIZED", "Bạn cần đăng nhập hoặc tạo phiên ẩn danh", 401);
    }

    request.auth = this.tokenService.verifyAccessToken(token);
    return true;
  }
}
