import { Module } from "@nestjs/common";
import { CommonAppModule } from "../common/common-app.module";
import { SessionsController } from "./sessions.controller";

@Module({
  imports: [CommonAppModule],
  controllers: [SessionsController]
})
export class SessionsModule {}
