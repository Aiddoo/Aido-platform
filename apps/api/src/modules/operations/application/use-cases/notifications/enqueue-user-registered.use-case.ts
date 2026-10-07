import { buildUserRegisteredMessage } from "../../messages/notifications/admin-message.factory.js";
import { type AdminNotificationQueuePort } from "../../ports/notifications/admin-notification-queue.port.js";
import type { UserRegisteredEventPayload } from "../../types/notifications/user-registered.payload.js";

/**
 * 회원가입 관리자 알림 등록 유스케이스.
 *
 * 회원가입 이벤트를 관리자 채널 Discord 알림 SEND 잡으로 큐에 등록한다.
 */
interface EnqueueUserRegisteredDependencies {
  readonly queue: Pick<AdminNotificationQueuePort, "enqueueSend">;
}

export class EnqueueUserRegistered {
  readonly #dependencies: EnqueueUserRegisteredDependencies;

  constructor(dependencies: EnqueueUserRegisteredDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(payload: UserRegisteredEventPayload): Promise<void> {
    const message = buildUserRegisteredMessage(payload);
    await this.#dependencies.queue.enqueueSend("admin", message);
  }
}
