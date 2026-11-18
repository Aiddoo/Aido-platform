import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { type NotificationRepositoryPort } from "../ports/notification.repository.port.js";

export interface DeleteActorNotificationsCommand {
  readonly actorId: UserId;
}

export interface DeleteActorNotificationsResult {
  readonly affectedUserIds: readonly UserId[];
}

interface DeleteActorNotificationsDependencies {
  readonly repository: Pick<NotificationRepositoryPort, "deleteNotificationsByActorId">;
}

/** 계정 purge가 연 트랜잭션 안에서 탈퇴한 사람이 남긴 알림을 지운다. 받은 사람 캐시는 커밋 뒤 따로 정리한다 */
export class DeleteActorNotificationsUseCase {
  readonly #dependencies: DeleteActorNotificationsDependencies;

  constructor(dependencies: DeleteActorNotificationsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: DeleteActorNotificationsCommand): Promise<DeleteActorNotificationsResult> {
    const { affectedUserIds } = await this.#dependencies.repository.deleteNotificationsByActorId(
      command.actorId,
    );
    return { affectedUserIds };
  }
}
