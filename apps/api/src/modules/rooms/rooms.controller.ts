import { Controller, Get, Inject, Param, Post, UseGuards } from "@nestjs/common";
import { ok } from "@chatandanh/shared";
import { AccessTokenGuard } from "../../common/access-token.guard";
import { CurrentAuth, type AuthContext } from "../../common/current-auth";
import { StoreService } from "../common/store.service";

@Controller("rooms")
export class RoomsController {
  constructor(@Inject(StoreService) private readonly store: StoreService) {}

  @Get()
  listRooms() {
    return ok({ items: this.store.listRooms() });
  }

  @Post(":roomId/join")
  @UseGuards(AccessTokenGuard)
  join(@CurrentAuth() auth: AuthContext, @Param("roomId") roomId: string) {
    return ok(this.store.joinRoom(auth.sessionId, roomId));
  }

  @Post(":roomId/leave")
  @UseGuards(AccessTokenGuard)
  leave(@Param("roomId") roomId: string) {
    return ok({ roomId, left: true });
  }
}
