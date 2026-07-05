import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { AdminModule } from "./modules/admin/admin.module";
import { AuthModule } from "./modules/auth/auth.module";
import { ChatModule } from "./modules/chat/chat.module";
import { CommonAppModule } from "./modules/common/common-app.module";
import { EngagementModule } from "./modules/engagement/engagement.module";
import { MatchingModule } from "./modules/matching/matching.module";
import { ProfilesModule } from "./modules/profiles/profiles.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { SessionsModule } from "./modules/sessions/sessions.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    CommonAppModule,
    AuthModule,
    SessionsModule,
    ProfilesModule,
    MatchingModule,
    ChatModule,
    EngagementModule,
    ReportsModule,
    AdminModule
  ]
})
export class AppModule {}
