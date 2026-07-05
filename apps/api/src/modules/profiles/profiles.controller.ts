import { Body, Controller, Get, Inject, Put, UseGuards } from "@nestjs/common";
import { chatProfileSchema, ok } from "@chatandanh/shared";
import { AccessTokenGuard } from "../../common/access-token.guard";
import { CurrentAuth, type AuthContext } from "../../common/current-auth";
import { StoreService } from "../common/store.service";

@Controller("me/profile")
@UseGuards(AccessTokenGuard)
export class ProfilesController {
  constructor(@Inject(StoreService) private readonly store: StoreService) {}

  @Get()
  getProfile(@CurrentAuth() auth: AuthContext) {
    const profile = this.store.getProfile(auth.sessionId);
    return ok({ profileComplete: Boolean(profile), profile });
  }

  @Put()
  updateProfile(@CurrentAuth() auth: AuthContext, @Body() body: unknown) {
    const profile = chatProfileSchema.parse(body);
    return ok({ profileComplete: true, profile: this.store.updateProfile(auth.sessionId, profile) });
  }
}
