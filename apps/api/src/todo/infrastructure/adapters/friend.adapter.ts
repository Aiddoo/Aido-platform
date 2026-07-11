import { Injectable } from "@nestjs/common";
import { FollowFacade } from "@/follow";
import type { FriendPort } from "../../application/ports/friend.port";

/**
 * 친구/맞팔 포트 어댑터 — FollowFacade에 위임
 */
@Injectable()
export class FriendAdapter implements FriendPort {
	constructor(private readonly followFacade: FollowFacade) {}

	isMutualFriend(userId: string, targetUserId: string): Promise<boolean> {
		return this.followFacade.isMutualFriend(userId, targetUserId);
	}

	getMutualFriendIds(userId: string): Promise<string[]> {
		return this.followFacade.getMutualFriendIds(userId);
	}

	getUserDisplayName(userId: string): Promise<string> {
		return this.followFacade.getUserDisplayName(userId);
	}
}
