import type { PushDevicePlatform } from "@aido/api/vocabulary";

import type { PushTokenReadModel } from "#api/modules/notification/push-devices/application/read-models/push-token.read-model";
import { PushDevice } from "#api/modules/notification/push-devices/domain/push-device.aggregate";

export const PUSH_TOKEN_FIXTURE_NOW = Temporal.Instant.from("2026-11-10T03:00:00Z");
export const PUSH_TOKEN_FIXTURE_USER_ID = "clz7x5p8k0031qz0z8z8z8z8z";
export const PUSH_TOKEN_FIXTURE_OTHER_USER_ID = "clz7x5p8k0032qz0z8z8z8z8z";

export function createPushTokenFixture(
  overrides: Partial<PushTokenReadModel> = {},
): PushTokenReadModel {
  return {
    id: 1,
    userId: PUSH_TOKEN_FIXTURE_USER_ID,
    token: "ExponentPushToken[token-a]",
    deviceId: "ios_device-a",
    platform: "IOS",
    provider: "EXPO",
    isActive: true,
    createdAt: PUSH_TOKEN_FIXTURE_NOW,
    updatedAt: PUSH_TOKEN_FIXTURE_NOW,
    lastUsedAt: PUSH_TOKEN_FIXTURE_NOW,
    payloadVersion: 2,
    appVersion: null,
    ...overrides,
  };
}

export interface PushTokenRegistrationFixture {
  readonly userId: string;
  readonly token: string;
  readonly deviceId: string;
  readonly platform: PushDevicePlatform;
  readonly sessionId: string | null;
  readonly payloadVersion: number;
  readonly appVersion: string | null;
  readonly registeredAt: Temporal.Instant;
}

// 권한을 허용하고 토큰을 보낸 기기 보고다. 저장하면 그 토큰을 등록한다
export function createRegisteringPushDeviceFixture(
  overrides: Partial<PushTokenRegistrationFixture> = {},
): PushDevice {
  const registration: PushTokenRegistrationFixture = {
    userId: PUSH_TOKEN_FIXTURE_USER_ID,
    token: "ExponentPushToken[token-a]",
    deviceId: "ios_device-a",
    platform: "IOS",
    sessionId: null,
    payloadVersion: 2,
    appVersion: null,
    registeredAt: PUSH_TOKEN_FIXTURE_NOW,
    ...overrides,
  };
  return PushDevice.reconstitute({
    deviceId: registration.deviceId,
    userId: registration.userId,
    sessionId: registration.sessionId,
    platform: registration.platform,
    permissionStatus: "GRANTED",
    permissionCanAskAgain: false,
    token: registration.token,
    channel: "EXPO",
    payloadVersion: registration.payloadVersion,
    appVersion: registration.appVersion,
    deviceModel: null,
    osVersion: null,
    reportedAt: registration.registeredAt,
  });
}
