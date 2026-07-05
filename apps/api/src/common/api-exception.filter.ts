import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import { fail } from "@chatandanh/shared";
import { ZodError } from "zod";
import { AppException } from "./app-exception";

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();

    if (exception instanceof AppException) {
      response.status(exception.getStatus()).json(fail(exception.code, exception.message, exception.details));
      return;
    }

    if (exception instanceof ZodError) {
      response
        .status(HttpStatus.BAD_REQUEST)
        .json(fail("VALIDATION_ERROR", "Dữ liệu chưa hợp lệ", exception.issues));
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      response.status(status).json(fail(status === 401 ? "UNAUTHORIZED" : "FORBIDDEN", exception.message));
      return;
    }

    console.error(exception);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(fail("FORBIDDEN", "Có lỗi xảy ra"));
  }
}
