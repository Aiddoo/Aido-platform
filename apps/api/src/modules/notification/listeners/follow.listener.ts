import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";

import {
	type FollowMutualEventPayload,
	type FollowNewEventPayload,
	NotificationEvents,
} from "../events/notification.events";
import { NotificationService } from "../notification.service";
import { NotificationMessageBuilder } from "../templates/notification-templates";

/**
 * Follow 이벤트 리스너
 *
 * FollowModule에서 발행하는 이벤트를 수신하여 알림을 생성합니다.
 * - follow.new: 새로운 팔로우 요청
 * - follow.mutual: 맞팔로우 성립 (친구 관계)
 */
@Injectable()
export class FollowListener {
	private readonly logger = new Logger(FollowListener.name);

	constructor(private readonly notificationService: NotificationService) {}

	/**
	 * 새로운 팔로우 요청 이벤트 처리
	 *
	 * 팔로우 요청을 받은 사용자에게 알림을 발송합니다.
	 */
	@OnEvent(NotificationEvents.FOLLOW_NEW)
	async handleFollowNew(payload: FollowNewEventPayload): Promise<void> {
		this.logger.debug(
			`Handling follow.new event: ${payload.followerId} -> ${payload.followingId}`,
		);

		try {
			const message = NotificationMessageBuilder.followNew(
				payload.followerName,
			);

			await this.notificationService.createAndSend({
				userId: payload.followingId,
				type: "FOLLOW_NEW",
				title: message.title,
				body: message.body,
				route: "/friends/requests",
				friendId: payload.followerId,
			});

			this.logger.log(
				`Follow request notification sent to user: ${payload.followingId}`,
			);
		} catch (error) {
			// 알림 발송 실패가 팔로우 기능을 방해하면 안 됨
			this.logger.error(
				`Failed to send follow request notification: ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
		}
	}

	/**
	 * 맞팔로우 성립 이벤트 처리
	 *
	 * 친구 성립 알림을 발송합니다.
	 * 이벤트는 각 사용자에게 개별적으로 발행되므로 단일 알림만 생성합니다.
	 */
	@OnEvent(NotificationEvents.FOLLOW_MUTUAL)
	async handleFollowMutual(payload: FollowMutualEventPayload): Promise<void> {
		this.logger.debug(
			`Handling follow.mutual event: user ${payload.userId} <-> friend ${payload.friendId}`,
		);

		try {
			const message = NotificationMessageBuilder.followAccepted(
				payload.friendName,
			);

			await this.notificationService.createAndSend({
				userId: payload.userId,
				type: "FOLLOW_ACCEPTED",
				title: message.title,
				body: message.body,
				route: `/friends/${payload.friendId}`,
				friendId: payload.friendId,
			});

			this.logger.log(
				`Mutual follow notification sent to user: ${payload.userId}`,
			);
		} catch (error) {
			this.logger.error(
				`Failed to send mutual follow notification: ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
		}
	}
}
