import { buildUserRegisteredMessage } from "../../../domain/services/notifications/admin-message.factory.js";
import type { UserRegisteredEventPayload } from "../../../domain/types/notifications/user-registered.payload.js";
import { type AdminNotificationQueuePort } from "../../ports/notifications/admin-notification-queue.port.js";

/**
 * 회원가입 관리자 알림 등록 유스케이스.
 *
 * 회원가입 이벤트를 관리자 채널 Discord 알림 SEND 잡으로 큐에 등록한다.
 */
interface EnqueueUserRegisteredDependencies {
  readonly queue: AdminNotificationQueuePort;
}

export class EnqueueUserRegistered {
  readonly #dependencies: EnqueueUserRegisteredDependencies;

  constructor(dependencies: EnqueueUserRegisteredDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(payload: UserRegisteredEventPayload): Promise<void> {
    const message = buildUserRegisteredMessage(payload);
    await this.#dependencies.queue.enqueueSend("admin", message.toPayload());
  }
}
