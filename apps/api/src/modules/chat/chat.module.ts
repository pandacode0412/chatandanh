import { Module } from "@nestjs/common";
import { CommonAppModule } from "../common/common-app.module";
import { ChatController } from "./chat.controller";
import { ChatGateway } from "../../realtime/chat.gateway";

@Module({
  imports: [CommonAppModule],
  controllers: [ChatController],
  providers: [ChatGateway]
})
export class ChatModule {}
