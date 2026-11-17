import type { PushPermissionStatus } from "@aido/api/vocabulary";

import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { PushDeviceId } from "../../domain/push-device-id.vo.js";
import type { PushDevice } from "../../domain/push-device.aggregate.js";

// 기기별 알림 권한 보고를 저장한다. 토큰은 PushTokenRepositoryPort가 소유한다
export abstract class PushDeviceRepositoryPort {
  // 계정을 바꿔 로그인한 기기라면 이전 사용자의 같은 기기 기록을 지우고 그 사용자 ID를 돌려준다
  abstract releasePushDeviceHeldElsewhere(
    userId: UserId,
    deviceId: PushDeviceId,
  ): Promise<{ readonly userIds: readonly string[] }>;
  abstract savePushDevice(device: PushDevice): Promise<void>;
  abstract deletePushDevice(userId: UserId, deviceId: PushDeviceId): Promise<void>;
  abstract deleteAllPushDevicesByUser(userId: UserId): Promise<void>;
  abstract deletePushDevicesBySessions(
    sessionIds: readonly string[],
  ): Promise<{ readonly userIds: readonly string[] }>;
  // reportedSince 이후 보고한 기기의 권한이고, 그런 기기가 없는 사용자는 Map에 없다
  abstract findPermissionStatusesByUsers(
    userIds: readonly UserId[],
    reportedSince: Temporal.Instant,
  ): Promise<ReadonlyMap<string, readonly PushPermissionStatus[]>>;
}
