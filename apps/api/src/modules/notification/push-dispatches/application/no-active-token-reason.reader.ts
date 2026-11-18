import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import {
  noActiveTokenSkipReason,
  type NoActiveTokenSkipReason,
  PUSH_DEVICE_STALE_AFTER_DAYS,
  type PushDeviceRepositoryPort,
} from "../../push-devices/notification-push-devices.public.js";

interface NoActiveTokenReasonReaderDependencies {
  readonly pushDeviceRepository: Pick<PushDeviceRepositoryPort, "findPermissionStatusesByUsers">;
  readonly clock: ClockPort;
}

// 활성 토큰이 없는 사람마다 최근 기기 권한 보고로 건너뛴 이유를 고른다(단건·배치 발송이 같이 쓴다)
export class NoActiveTokenReasonReader {
  readonly #dependencies: NoActiveTokenReasonReaderDependencies;

  constructor(dependencies: NoActiveTokenReasonReaderDependencies) {
    this.#dependencies = dependencies;
  }

  async findReasons(
    userIds: readonly string[],
  ): Promise<ReadonlyMap<string, NoActiveTokenSkipReason>> {
    if (userIds.length === 0) {
      return new Map();
    }
    const statusesByUser =
      await this.#dependencies.pushDeviceRepository.findPermissionStatusesByUsers(
        userIds.map((userId) => UserId.reconstitute(userId)),
        this.#dependencies.clock.now().subtract({ hours: 24 * PUSH_DEVICE_STALE_AFTER_DAYS }),
      );
    return new Map(
      userIds.map((userId) => [userId, noActiveTokenSkipReason(statusesByUser.get(userId) ?? [])]),
    );
  }

  async findReason(userId: string): Promise<NoActiveTokenSkipReason> {
    const reasons = await this.findReasons([userId]);
    return reasons.get(userId) ?? "NO_ACTIVE_TOKEN";
  }
}
