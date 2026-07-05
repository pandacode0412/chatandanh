import { HttpException, HttpStatus } from "@nestjs/common";
import type { ErrorCode } from "@chatandanh/shared";

export class AppException extends HttpException {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    public readonly details: unknown[] = []
  ) {
    super({ code, message, details }, status);
  }
}
