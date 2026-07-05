import { Module } from "@nestjs/common";
import { CommonAppModule } from "../common/common-app.module";
import { RoomsController } from "./rooms.controller";

@Module({
  imports: [CommonAppModule],
  controllers: [RoomsController]
})
export class RoomsModule {}
