import { Module } from "@nestjs/common";
import { CommonAppModule } from "../common/common-app.module";
import { AdminController } from "./admin.controller";

@Module({
  imports: [CommonAppModule],
  controllers: [AdminController]
})
export class AdminModule {}
