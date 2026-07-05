import { Module } from "@nestjs/common";
import { CommonAppModule } from "../common/common-app.module";
import { ReportsController } from "./reports.controller";

@Module({
  imports: [CommonAppModule],
  controllers: [ReportsController]
})
export class ReportsModule {}
