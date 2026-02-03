/**
 * Notification 모델 테스트 데이터 빌더
 *
 * @example
 * ```typescript
 * // 기본 알림
 * const notification = NotificationBuilder.create('user-123').build();
 *
 * // 읽은 알림
 * const read = NotificationBuilder.create('user-123').asRead().build();
 *
 * // 친구 요청 알림
 * const followNew = NotificationBuilder.create('user-123')
 *   .asFollowNew('friend-456')
 *   .build();
 * ```
 */
import type { Notification, NotificationType } from "@/generated/prisma/client";

export class NotificationBuilder {
	private data: Notification;
	private static idCounter = 0;

	private constructor(userId: string) {
		const now = new Date();
		NotificationBuilder.idCounter += 1;
		this.data = {
			id: NotificationBuilder.idCounter,
			userId,
			type: "FOLLOW_NEW" as NotificationType,
			title: "새로운 알림",
			body: "알림 내용입니다",
			isRead: false,
			todoId: null,
			friendId: null,
			nudgeId: null,
			cheerId: null,
			metadata: null,
			createdAt: now,
			readAt: null,
		};
	}

	static create(userId: string): NotificationBuilder {
		return new NotificationBuilder(userId);
	}

	/** ID 카운터 리셋 (테스트 간 격리용) */
	static resetIdCounter(): void {
		NotificationBuilder.idCounter = 0;
	}

	// === ID 관련 ===

	withId(id: number): NotificationBuilder {
		this.data.id = id;
		return this;
	}

	// === 타입/내용 관련 ===

	withType(type: NotificationType): NotificationBuilder {
		this.data.type = type;
		return this;
	}

	withTitle(title: string): NotificationBuilder {
		this.data.title = title;
		return this;
	}

	withBody(body: string): NotificationBuilder {
		this.data.body = body;
		return this;
	}

	withContent(title: string, body: string): NotificationBuilder {
		this.data.title = title;
		this.data.body = body;
		return this;
	}

	// === 관련 엔티티 ===

	withFriendId(friendId: string): NotificationBuilder {
		this.data.friendId = friendId;
		return this;
	}

	withTodoId(todoId: number): NotificationBuilder {
		this.data.todoId = todoId;
		return this;
	}

	withNudgeId(nudgeId: number): NotificationBuilder {
		this.data.nudgeId = nudgeId;
		return this;
	}

	withCheerId(cheerId: number): NotificationBuilder {
		this.data.cheerId = cheerId;
		return this;
	}

	withMetadata(metadata: object): NotificationBuilder {
		this.data.metadata = metadata;
		return this;
	}

	// === 읽음 상태 ===

	asRead(readAt?: Date): NotificationBuilder {
		this.data.isRead = true;
		this.data.readAt = readAt ?? new Date();
		return this;
	}

	asUnread(): NotificationBuilder {
		this.data.isRead = false;
		this.data.readAt = null;
		return this;
	}

	// === 알림 타입별 편의 메서드 ===

	asFollowNew(friendId: string): NotificationBuilder {
		this.data.type = "FOLLOW_NEW" as NotificationType;
		this.data.friendId = friendId;
		this.data.title = "새로운 친구 요청";
		this.data.body = "누군가 친구가 되고 싶어해요";
		return this;
	}

	asMorningReminder(): NotificationBuilder {
		this.data.type = "MORNING_REMINDER" as NotificationType;
		this.data.title = "좋은 아침이에요!";
		this.data.body = "오늘 할일이 기다리고 있어요";
		return this;
	}

	asEveningReminder(): NotificationBuilder {
		this.data.type = "EVENING_REMINDER" as NotificationType;
		this.data.title = "오늘 하루 수고했어요!";
		this.data.body = "내일 할일을 미리 확인해보세요";
		return this;
	}

	asNudgeReceived(friendId: string, nudgeId: number): NotificationBuilder {
		this.data.type = "NUDGE_RECEIVED" as NotificationType;
		this.data.friendId = friendId;
		this.data.nudgeId = nudgeId;
		this.data.title = "콕 찌르기!";
		this.data.body = "친구가 당신을 찔렀어요";
		return this;
	}

	asCheerReceived(friendId: string, cheerId: number): NotificationBuilder {
		this.data.type = "CHEER_RECEIVED" as NotificationType;
		this.data.friendId = friendId;
		this.data.cheerId = cheerId;
		this.data.title = "응원 메시지!";
		this.data.body = "친구가 응원을 보냈어요";
		return this;
	}

	asSystemNotice(): NotificationBuilder {
		this.data.type = "SYSTEM_NOTICE" as NotificationType;
		this.data.title = "시스템 공지";
		this.data.body = "서비스 점검 예정";
		return this;
	}

	// === 타임스탬프 관련 ===

	withCreatedAt(date: Date): NotificationBuilder {
		this.data.createdAt = date;
		return this;
	}

	// === 빌드 ===

	build(): Notification {
		return { ...this.data };
	}

	/** 여러 개 생성 */
	static createMany(userId: string, count: number): Notification[] {
		return Array.from({ length: count }, () =>
			NotificationBuilder.create(userId).build(),
		);
	}
}
