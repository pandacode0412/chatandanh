import { Module } from "@nestjs/common";
import { CommonAppModule } from "../common/common-app.module";
import { ProfilesController } from "./profiles.controller";

@Module({
  imports: [CommonAppModule],
  controllers: [ProfilesController]
})
export class ProfilesModule {}
