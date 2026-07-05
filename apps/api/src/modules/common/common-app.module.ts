import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AccessTokenGuard } from "../../common/access-token.guard";
import { StoreService } from "./store.service";
import { TokenService } from "./token.service";

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET ?? "dev-change-me",
      signOptions: { expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN ?? "15m") as never }
    })
  ],
  providers: [AccessTokenGuard, StoreService, TokenService],
  exports: [AccessTokenGuard, StoreService, TokenService]
})
export class CommonAppModule {}
