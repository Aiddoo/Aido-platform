import { Injectable } from "@nestjs/common";

import type { CursorPaginatedResponse } from "@/shared/application/pagination";

import type { ReorderPosition } from "../../domain/services/friend-reorder";
import type { FollowWithUser } from "../ports/follow.repository.port";
import { FollowReader, type GetFollowsParams } from "../services/follow.reader";
import { AcceptFriendRequestUseCase } from "../use-cases/accept-friend-request/accept-friend-request.use-case";
import { RejectFriendRequestUseCase } from "../use-cases/reject-friend-request/reject-friend-request.use-case";
import { RemoveFriendUseCase } from "../use-cases/remove-friend/remove-friend.use-case";
import { ReorderFriendUseCase } from "../use-cases/reorder-friend/reorder-friend.use-case";
import type { SendFriendRequestResult } from "../use-cases/send-friend-request/send-friend-request.use-case";
import {
	type SendFriendRequestByTagInput,
	SendFriendRequestByTagUseCase,
} from "../use-cases/send-friend-request-by-tag/send-friend-request-by-tag.use-case";

/**
 * FollowFacade — follow 모듈의 유일한 공개 표면.
 *
 * 컨트롤러와 크로스모듈 소비자(todo·cheer·nudge)는 이 파사드만 주입한다.
 * 파사드는 use-case 클래스와 reader를 직접 주입해 위임한다(버스 없음).
 */
@Injectable()
export class FollowFacade {
	constructor(
		private readonly reader: FollowReader,
		private readonly sendFriendRequestByTag: SendFriendRequestByTagUseCase,
		private readonly acceptFriendRequestUseCase: AcceptFriendRequestUseCase,
		private readonly rejectFriendRequestUseCase: RejectFriendRequestUseCase,
		private readonly removeFriendUseCase: RemoveFriendUseCase,
		private readonly reorderFriendUseCase: ReorderFriendUseCase,
	) {}

	// === 쓰기 ===

	sendRequestByTag(
		userId: string,
		targetUserTag: string,
	): Promise<SendFriendRequestResult> {
		const input: SendFriendRequestByTagInput = { userId, targetUserTag };
		return this.sendFriendRequestByTag.execute(input);
	}

	acceptRequest(
		userId: string,
		requesterUserId: string,
	): Promise<FollowWithUser> {
		return this.acceptFriendRequestUseCase.execute({ userId, requesterUserId });
	}

	rejectRequest(userId: string, requesterUserId: string): Promise<void> {
		return this.rejectFriendRequestUseCase.execute({ userId, requesterUserId });
	}

	remove(userId: string, targetUserId: string): Promise<void> {
		return this.removeFriendUseCase.execute({ userId, targetUserId });
	}

	reorder(
		followId: string,
		userId: string,
		data: { targetFollowId?: string; position: ReorderPosition },
	): Promise<FollowWithUser> {
		return this.reorderFriendUseCase.execute({
			followId,
			userId,
			targetFollowId: data.targetFollowId,
			position: data.position,
		});
	}

	// === 읽기 ===

	getResourceLimitInfo(
		userId: string,
	): Promise<{ friendCount: number; maxCount: number | null }> {
		return this.reader.getResourceLimitInfo(userId);
	}

	getFriends(
		params: GetFollowsParams,
	): Promise<CursorPaginatedResponse<FollowWithUser, string>> {
		return this.reader.getFriends(params);
	}

	getReceivedRequests(
		params: GetFollowsParams,
	): Promise<CursorPaginatedResponse<FollowWithUser, string>> {
		return this.reader.getReceivedRequests(params);
	}

	getSentRequests(
		params: GetFollowsParams,
	): Promise<CursorPaginatedResponse<FollowWithUser, string>> {
		return this.reader.getSentRequests(params);
	}

	countFriends(userId: string): Promise<number> {
		return this.reader.countFriends(userId);
	}

	countReceivedRequests(userId: string): Promise<number> {
		return this.reader.countReceivedRequests(userId);
	}

	countSentRequests(userId: string): Promise<number> {
		return this.reader.countSentRequests(userId);
	}

	// === 크로스모듈 (todo/cheer/nudge 포트가 소비) ===

	isMutualFriend(userId: string, targetUserId: string): Promise<boolean> {
		return this.reader.isMutualFriend(userId, targetUserId);
	}

	getMutualFriendIds(userId: string): Promise<string[]> {
		return this.reader.getMutualFriendIds(userId);
	}

	getUserDisplayName(userId: string): Promise<string> {
		return this.reader.getUserDisplayName(userId);
	}
}
