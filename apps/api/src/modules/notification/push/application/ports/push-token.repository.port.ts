import type { PushDevicePlatform } from "@aido/api/vocabulary";

import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { PushDeviceId } from "../../domain/push-device-id.vo.js";
import type { PushTokenRecord } from "../read-models/push-token.read-model.js";

export interface FindPushTokensParams {
  readonly userId: UserId;
  readonly activeOnly?: boolean;
}

export interface RegisterPushTokenData {
  readonly userId: UserId;
  readonly token: string;
  readonly deviceId: PushDeviceId;
  readonly platform: PushDevicePlatform;
  readonly sessionId: string | null;
  readonly payloadVersion: number;
  readonly appVersion: string | null;
  readonly registeredAt: Temporal.Instant;
}

// 같은 토큰이 동시에 등록돼 다른 트랜잭션이 먼저 그 토큰을 가져갔다. 원인 DB 오류는 cause로 남긴다
export class PushTokenRegistrationConflictError extends Error {
  constructor(options?: ErrorOptions) {
    super("Push token registered concurrently", options);
    this.name = "PushTokenRegistrationConflictError";
  }
}

// Expo 등록 토큰의 생명주기를 저장한다
export abstract class PushTokenRepositoryPort {
  // 이 기기나 이 토큰을 다른 사용자·기기가 가진 등록을 지우고 그 사용자 ID를 돌려준다(해제 실패 기기에 새 사용자가 로그인했을 때 unique 충돌·잘못된 수신 방지)
  abstract releasePushTokenHeldElsewhere(data: {
    readonly userId: UserId;
    readonly deviceId: PushDeviceId;
    readonly token: string | null;
  }): Promise<{ readonly userIds: readonly string[] }>;
  abstract registerPushToken(data: RegisterPushTokenData): Promise<PushTokenRecord>;
  abstract findPushTokensByUser(params: FindPushTokensParams): Promise<PushTokenRecord[]>;
  abstract findActivePushTokensByUsers(userIds: readonly UserId[]): Promise<PushTokenRecord[]>;
  abstract deletePushTokensByDevice(
    userId: UserId,
    deviceId: PushDeviceId,
  ): Promise<{ count: number }>;
  abstract deleteAllPushTokensByUser(userId: UserId): Promise<{ count: number }>;
  // 지운 토큰마다 그 사용자 ID를 하나씩 돌려준다
  abstract deletePushTokensBySessions(
    sessionIds: readonly string[],
  ): Promise<{ readonly userIds: readonly string[] }>;
  abstract deactivateInvalidTokens(
    tokens: string[],
    deactivatedAt: Temporal.Instant,
  ): Promise<{ count: number }>;
}
