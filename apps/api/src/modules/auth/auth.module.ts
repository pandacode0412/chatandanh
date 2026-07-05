import { Module } from "@nestjs/common";
import { CommonAppModule } from "../common/common-app.module";
import { AuthController } from "./auth.controller";

@Module({
  imports: [CommonAppModule],
  controllers: [AuthController]
})
export class AuthModule {}
