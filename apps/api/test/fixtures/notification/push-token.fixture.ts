import type { RegisterPushTokenData } from "#api/modules/notification/push/application/ports/push-token.repository.port";
import type { PushTokenRecord } from "#api/modules/notification/push/application/read-models/push-token.read-model";
import { PushDeviceId } from "#api/modules/notification/push/domain/push-device-id.vo";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

export const PUSH_TOKEN_FIXTURE_NOW = Temporal.Instant.from("2026-11-10T03:00:00Z");
export const PUSH_TOKEN_FIXTURE_USER_ID = "clz7x5p8k0031qz0z8z8z8z8z";
export const PUSH_TOKEN_FIXTURE_OTHER_USER_ID = "clz7x5p8k0032qz0z8z8z8z8z";

export function createPushTokenFixture(overrides: Partial<PushTokenRecord> = {}): PushTokenRecord {
  return {
    id: 1,
    userId: PUSH_TOKEN_FIXTURE_USER_ID,
    token: "ExponentPushToken[token-a]",
    deviceId: "ios_device-a",
    platform: "IOS",
    isActive: true,
    createdAt: PUSH_TOKEN_FIXTURE_NOW,
    updatedAt: PUSH_TOKEN_FIXTURE_NOW,
    lastUsedAt: PUSH_TOKEN_FIXTURE_NOW,
    payloadVersion: 2,
    appVersion: null,
    ...overrides,
  };
}

export function createRegisterPushTokenDataFixture(
  overrides: Partial<RegisterPushTokenData> = {},
): RegisterPushTokenData {
  return {
    userId: UserId.reconstitute(PUSH_TOKEN_FIXTURE_USER_ID),
    token: "ExponentPushToken[token-a]",
    deviceId: PushDeviceId.reconstitute("ios_device-a"),
    platform: "IOS",
    sessionId: null,
    payloadVersion: 2,
    appVersion: null,
    registeredAt: PUSH_TOKEN_FIXTURE_NOW,
    ...overrides,
  };
}
