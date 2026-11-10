import {
  buildUserRegisteredNotice,
  registeredNoticeUserOf,
} from "../messages/admin-notice.messages.js";
import type { AdminNotificationQueuePort } from "../ports/admin-notification-queue.port.js";
import type { UserRegisteredEventPayload } from "../read-models/user-registered.read-model.js";
import type { ResolveAdminNoticeUserUseCase } from "./resolve-admin-notice-user.use-case.js";

export interface EnqueueUserRegisteredDependencies {
  readonly queue: Pick<AdminNotificationQueuePort, "enqueueSend">;
  readonly resolveUser: Pick<ResolveAdminNoticeUserUseCase, "execute">;
}

/** 결제 알림과 같은 사용자 블록을 붙여 관리자 채널 SEND 작업으로 등록한다. */
export class EnqueueUserRegisteredUseCase {
  readonly #dependencies: EnqueueUserRegisteredDependencies;

  constructor(dependencies: EnqueueUserRegisteredDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(payload: UserRegisteredEventPayload): Promise<void> {
    const { queue, resolveUser } = this.#dependencies;
    const user = await resolveUser.execute(registeredNoticeUserOf(payload));
    await queue.enqueueSend("admin", buildUserRegisteredNotice(payload, user));
  }
}
