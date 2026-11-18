import type { SessionId } from "#api/modules/identity/sessions/identity-sessions.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { PushDeviceId } from "../../domain/push-device-id.vo.js";
import type { PushTokenReadModel } from "../read-models/push-token.read-model.js";

export interface FindPushTokensParams {
  readonly userId: UserId;
  readonly activeOnly?: boolean;
}

// 등록한 Expo 토큰을 읽고 기기 보고 밖의 경로(해제·세션 정리·무효 토큰)로 지운다
export abstract class PushTokenRepositoryPort {
  abstract findPushTokensByUser(params: FindPushTokensParams): Promise<PushTokenReadModel[]>;
  abstract findActivePushTokensByUsers(userIds: readonly UserId[]): Promise<PushTokenReadModel[]>;
  abstract deletePushTokensByDevice(
    userId: UserId,
    deviceId: PushDeviceId,
  ): Promise<{ count: number }>;
  abstract deleteAllPushTokensByUser(userId: UserId): Promise<{ count: number }>;
  // 로그인 없는 해제 요청은 기기 ID와 그 기기의 토큰을 함께 아는 것으로 기기를 가졌음을 증명한다. 둘 다 맞는 등록만 지우고 그 주인 ID를 준다
  abstract deletePushTokenByDeviceAndToken(data: {
    readonly deviceId: PushDeviceId;
    readonly token: string;
  }): Promise<{ readonly userIds: readonly UserId[] }>;
  // 지운 토큰마다 그 사용자 ID를 하나씩 돌려준다
  abstract deletePushTokensBySessions(
    sessionIds: readonly SessionId[],
  ): Promise<{ readonly userIds: readonly UserId[] }>;
  abstract deactivateInvalidTokens(
    tokens: string[],
    deactivatedAt: Temporal.Instant,
  ): Promise<{ count: number }>;
  // 마지막 기기 보고(활성 토큰의 updatedAt)가 기준보다 오래된 활성 토큰을 오래된 순으로 limit개 끈다.
  // 끈 토큰마다 그 사용자 ID를 하나씩 돌려준다
  abstract deactivateUnreportedSince(command: {
    readonly reportedBefore: Temporal.Instant;
    readonly deactivatedAt: Temporal.Instant;
    readonly limit: number;
  }): Promise<{ readonly userIds: readonly UserId[] }>;
}
