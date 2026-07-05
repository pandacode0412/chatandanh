import { Body, Controller, Inject, Post, UseGuards } from "@nestjs/common";
import { cancelMatchingSchema, ok, startMatchingSchema } from "@chatandanh/shared";
import { AccessTokenGuard } from "../../common/access-token.guard";
import { CurrentAuth, type AuthContext } from "../../common/current-auth";
import { StoreService } from "../common/store.service";

@Controller("matching")
@UseGuards(AccessTokenGuard)
export class MatchingController {
  constructor(@Inject(StoreService) private readonly store: StoreService) {}

  @Post("start")
  start(@CurrentAuth() auth: AuthContext, @Body() body: unknown) {
    const payload = startMatchingSchema.parse(body);
    const result = this.store.startMatching(
      auth.sessionId,
      payload.topicId,
      payload.preferences?.desiredGenders,
      payload.preferences?.strictGenderMatch ?? true
    );
    return ok(result);
  }

  @Post("cancel")
  cancel(@CurrentAuth() auth: AuthContext, @Body() body: unknown) {
    const payload = cancelMatchingSchema.parse(body);
    this.store.cancelMatching(auth.sessionId, payload.requestId);
    return ok({ status: "cancelled" });
  }
}
