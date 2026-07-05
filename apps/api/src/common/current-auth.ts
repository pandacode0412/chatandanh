import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export interface AuthContext {
  sessionId: string;
  accountId?: string;
  mode: "guest" | "registered" | "premium";
  role?: "user" | "moderator" | "admin";
}

export const CurrentAuth = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthContext => {
  return ctx.switchToHttp().getRequest().auth;
});
