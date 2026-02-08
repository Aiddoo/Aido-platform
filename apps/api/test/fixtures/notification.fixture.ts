/**
 * Notification 테스트 Fixture
 *
 * 타입 안전한 Notification 및 관련 엔티티 테스트 데이터 생성
 */
import type {
	Notification,
	NotificationType,
	Platform,
	PushToken,
} from "@/generated/prisma/client";

let notificationCounter = 0;
let pushTokenCounter = 0;

/**
 * Notification Fixture 팩토리
 *
 * @example
 * ```typescript
 * // 기본 Notification 생성
 * const notification = NotificationFixture.create({ userId: 'user-1' });
 *
 * // 읽은 Notification 생성
 * const read = NotificationFixture.createRead({ userId: 'user-1' });
 * ```
 */
export const NotificationFixture = {
	/**
	 * Notification 엔티티 생성
	 */
	create: (overrides: Partial<Notification> = {}): Notification => {
		const id = ++notificationCounter;
		const now = new Date();

		return {
			id: overrides.id ?? id,
			userId: overrides.userId ?? `user-${id}`,
			type: overrides.type ?? "SYSTEM_NOTICE",
			title: overrides.title ?? `Notification ${id}`,
			body: overrides.body ?? `This is notification body ${id}`,
			isRead: overrides.isRead ?? false,
			todoId: overrides.todoId ?? null,
			friendId: overrides.friendId ?? null,
			nudgeId: overrides.nudgeId ?? null,
			cheerId: overrides.cheerId ?? null,
			metadata: overrides.metadata ?? null,
			readAt: overrides.readAt ?? null,
			createdAt: overrides.createdAt ?? now,
			notificationDate: overrides.notificationDate ?? null,
		};
	},

	/**
	 * 읽은 Notification 생성
	 */
	createRead: (overrides: Partial<Notification> = {}): Notification => {
		return NotificationFixture.create({
			isRead: true,
			readAt: new Date(),
			...overrides,
		});
	},

	/**
	 * 특정 타입의 Notification 생성
	 */
	createByType: (
		type: NotificationType,
		overrides: Partial<Notification> = {},
	): Notification => {
		return NotificationFixture.create({
			type,
			...overrides,
		});
	},

	/**
	 * 여러 Notification 생성
	 */
	createMany: (
		count: number,
		overrides: Partial<Notification> = {},
	): Notification[] => {
		return Array.from({ length: count }, () =>
			NotificationFixture.create(overrides),
		);
	},

	/**
	 * 카운터 리셋
	 */
	reset: (): void => {
		notificationCounter = 0;
	},
};

/**
 * PushToken Fixture 팩토리
 */
export const PushTokenFixture = {
	/**
	 * PushToken 엔티티 생성
	 */
	create: (overrides: Partial<PushToken> = {}): PushToken => {
		const id = ++pushTokenCounter;
		const now = new Date();

		return {
			id: overrides.id ?? id,
			userId: overrides.userId ?? `user-${id}`,
			token: overrides.token ?? `ExponentPushToken[${id}]`,
			platform: overrides.platform ?? ("IOS" as Platform),
			deviceId: overrides.deviceId ?? `device-${id}`,
			isActive: overrides.isActive ?? true,
			lastUsedAt: overrides.lastUsedAt ?? now,
			createdAt: overrides.createdAt ?? now,
			updatedAt: overrides.updatedAt ?? now,
		};
	},

	/**
	 * 비활성 PushToken 생성
	 */
	createInactive: (overrides: Partial<PushToken> = {}): PushToken => {
		return PushTokenFixture.create({
			isActive: false,
			...overrides,
		});
	},

	/**
	 * 카운터 리셋
	 */
	reset: (): void => {
		pushTokenCounter = 0;
	},
};
