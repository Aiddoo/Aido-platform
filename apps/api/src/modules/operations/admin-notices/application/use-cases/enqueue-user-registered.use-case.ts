import {
  buildUserRegisteredNotice,
  registeredNoticeUserOf,
} from "../messages/admin-notice.messages.js";
import { type AdminNotificationQueuePort } from "../ports/admin-notification-queue.port.js";
import type { UserRegisteredEventPayload } from "../read-models/user-registered.read-model.js";
import type { AdminNoticeUserResolver } from "./resolve-admin-notice-user.use-case.js";

/**
 * 회원가입 관리자 알림 등록 유스케이스.
 *
 * 결제 알림과 같은 사용자 블록을 붙여 관리자 채널 SEND 잡으로 등록한다.
 */
interface EnqueueUserRegisteredDependencies {
  readonly queue: Pick<AdminNotificationQueuePort, "enqueueSend">;
  readonly users: Pick<AdminNoticeUserResolver, "resolve">;
}

export class EnqueueUserRegistered {
  readonly #dependencies: EnqueueUserRegisteredDependencies;

  constructor(dependencies: EnqueueUserRegisteredDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(payload: UserRegisteredEventPayload): Promise<void> {
    const user = await this.#dependencies.users.resolve(registeredNoticeUserOf(payload));
    await this.#dependencies.queue.enqueueSend("admin", buildUserRegisteredNotice(payload, user));
  }
}
