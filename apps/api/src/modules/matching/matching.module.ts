import { Module } from "@nestjs/common";
import { CommonAppModule } from "../common/common-app.module";
import { MatchingController } from "./matching.controller";

@Module({
  imports: [CommonAppModule],
  controllers: [MatchingController]
})
export class MatchingModule {}
