import type { PushPermissionStatus } from "@aido/api/vocabulary";

import type { SessionId } from "#api/modules/identity/sessions/identity-sessions.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { PushDeviceId } from "../../domain/push-device-id.vo.js";
import type { PushDevice } from "../../domain/push-device.aggregate.js";

export interface SavedPushDeviceResult {
  // 넘겨받은 등록의 이전 사용자 ID다. 같은 사용자가 여러 번 나올 수 있다
  readonly previousOwnerIds: readonly UserId[];
  readonly hasActiveToken: boolean;
}

// 기기 보고(권한·토큰 등록)를 저장한다. 묶음 해제·무효 토큰 정리와 토큰 조회는 PushTokenRepositoryPort다
export abstract class PushDeviceRepositoryPort {
  // 넘겨받을 다른 등록을 지우고 기기 행과 토큰 변경(등록·유지·해제)을 쓴다. 같은 토큰을 다른 등록이 먼저 잡았으면
  // PushTokenRegistrationConflictError다. UnitOfWork 안에서 호출한다
  abstract save(device: PushDevice): Promise<SavedPushDeviceResult>;
  abstract deletePushDevice(userId: UserId, deviceId: PushDeviceId): Promise<void>;
  abstract deleteAllPushDevicesByUser(userId: UserId): Promise<void>;
  abstract deletePushDevicesBySessions(
    sessionIds: readonly SessionId[],
  ): Promise<{ readonly userIds: readonly UserId[] }>;
  // reportedSince 이후 보고한 기기의 권한이고, 그런 기기가 없는 사용자는 Map에 없다
  abstract findPermissionStatusesByUsers(
    userIds: readonly UserId[],
    reportedSince: Temporal.Instant,
  ): Promise<ReadonlyMap<string, readonly PushPermissionStatus[]>>;
}
