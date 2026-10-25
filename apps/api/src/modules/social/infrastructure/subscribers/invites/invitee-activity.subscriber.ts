import { Inject, Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";

import { TODO_EVENTS, type TodoToggledEvent } from "#api/modules/planning/planning-todos.public";
import { now } from "#api/shared/domain/date/utils/core";

import { SocialInviteLogEvent } from "../../../application/observability/invites/social-invite-log.events.js";
import { RecordInviteeActivity } from "../../../application/use-cases/invites/record-invitee-activity.use-case.js";

/** 할 일 완료를 초대 사용 시작 기록으로 넘긴다. 상태를 들고 있지 않고 실패는 할 일 흐름에 전파하지 않는다. */
@Injectable()
export class InviteeActivitySubscriber {
  readonly #logger = new Logger(InviteeActivitySubscriber.name);

  constructor(
    @Inject(RecordInviteeActivity)
    private readonly recordInviteeActivity: Pick<RecordInviteeActivity, "execute">,
  ) {}

  @OnEvent(TODO_EVENTS.TOGGLED)
  async handle(event: TodoToggledEvent): Promise<void> {
    if (!event.completed) return;
    try {
      await this.recordInviteeActivity.execute({
        inviteeId: event.userId,
        occurredAt: now(),
      });
    } catch (error) {
      this.#logger.warn({
        event: SocialInviteLogEvent.ACTIVITY_RECORD_FAILED,
        userId: event.userId,
        errorType: error instanceof Error ? error.name : "UnknownError",
      });
    }
  }
}
