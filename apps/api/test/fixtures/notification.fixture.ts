/**
 * Notification 테스트 Fixture
 *
 * 타입 안전한 Notification 및 관련 엔티티 테스트 데이터 생성
 */
import type { ReportPushDeviceCommand } from "#api/modules/notification/application/use-cases/delivery/report-push-device.use-case";
import type { Notification, NotificationType, PushToken } from "#test/types/database-rows";

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
      actionType: overrides.actionType ?? "DEEP_LINK",
      actionUrl: overrides.actionUrl ?? null,
      campaignKey: overrides.campaignKey ?? null,
      variantId: overrides.variantId ?? null,
      purpose: overrides.purpose ?? "TRANSACTIONAL",
      openedAt: overrides.openedAt ?? null,
    };
  },

  createRead: (overrides: Partial<Notification> = {}): Notification => {
    return NotificationFixture.create({
      isRead: true,
      readAt: new Date(),
      ...overrides,
    });
  },

  createByType: (type: NotificationType, overrides: Partial<Notification> = {}): Notification => {
    return NotificationFixture.create({
      type,
      ...overrides,
    });
  },

  createMany: (count: number, overrides: Partial<Notification> = {}): Notification[] => {
    return Array.from({ length: count }, () => NotificationFixture.create(overrides));
  },

  reset: (): void => {
    notificationCounter = 0;
  },
};

export const PushTokenFixture = {
  create: (overrides: Partial<PushToken> = {}): PushToken => {
    const id = ++pushTokenCounter;
    const now = new Date();

    return {
      id: overrides.id ?? id,
      userId: overrides.userId ?? `user-${id}`,
      token: overrides.token ?? `ExponentPushToken[${id}]`,
      platform: overrides.platform ?? "IOS",
      deviceId: overrides.deviceId ?? `ios_device-${id}`,
      sessionId: overrides.sessionId ?? null,
      isActive: overrides.isActive ?? true,
      lastUsedAt: overrides.lastUsedAt ?? now,
      createdAt: overrides.createdAt ?? now,
      updatedAt: overrides.updatedAt ?? now,
      payloadVersion: overrides.payloadVersion ?? 1,
      appVersion: overrides.appVersion ?? null,
    };
  },

  createInactive: (overrides: Partial<PushToken> = {}): PushToken => {
    return PushTokenFixture.create({
      isActive: false,
      ...overrides,
    });
  },

  reset: (): void => {
    pushTokenCounter = 0;
  },
};

/** 헤더에서 오는 값은 보내지 않은 상태(null)가 기본이다. */
export const PushDeviceReportFixture = {
  command: (overrides: Partial<ReportPushDeviceCommand> = {}): ReportPushDeviceCommand => ({
    userId: "user-a",
    sessionId: null,
    deviceId: "ios_device-a",
    permission: { status: "GRANTED", canAskAgain: false },
    token: "ExponentPushToken[device-a]",
    payloadVersion: 2,
    appVersion: null,
    deviceModel: null,
    osVersion: null,
    timezone: null,
    locale: null,
    ...overrides,
  }),
};
