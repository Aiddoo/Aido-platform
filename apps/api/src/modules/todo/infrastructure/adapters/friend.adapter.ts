import { Injectable } from "@nestjs/common";
import { FollowService } from "../../../follow/follow.service";
import type { FriendPort } from "../../application/ports/friend.port";

/**
 * 친구/맞팔 포트 어댑터 — FollowService에 위임
 */
@Injectable()
export class FriendAdapter implements FriendPort {
	constructor(private readonly followService: FollowService) {}

	isMutualFriend(userId: string, targetUserId: string): Promise<boolean> {
		return this.followService.isMutualFriend(userId, targetUserId);
	}

	getMutualFriendIds(userId: string): Promise<string[]> {
		return this.followService.getMutualFriendIds(userId);
	}

	getUserDisplayName(userId: string): Promise<string> {
		return this.followService.getUserDisplayName(userId);
	}
}
