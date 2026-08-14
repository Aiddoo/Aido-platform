import { Injectable } from "@nestjs/common";

import { FollowReader } from "@/follow";

import type { FriendPort } from "../../application/ports/friend.port";

/**
 * 친구/맞팔 포트 어댑터 — FollowReader에 위임
 */
@Injectable()
export class FriendAdapter implements FriendPort {
	constructor(private readonly followReader: FollowReader) {}

	isMutualFriend(userId: string, targetUserId: string): Promise<boolean> {
		return this.followReader.isMutualFriend(userId, targetUserId);
	}

	getMutualFriendIds(userId: string): Promise<string[]> {
		return this.followReader.getMutualFriendIds(userId);
	}

	getUserDisplayName(userId: string): Promise<string> {
		return this.followReader.getUserDisplayName(userId);
	}
}
