import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import type { z } from "zod";

import { todoChangedPayloadSchema } from "#api/modules/planning/todos/planning-todos.public";
import { defineEventSubscription } from "#api/shared/application/ports/domain-event-publisher.port";
import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";

import { InviteRedemptionLogEvent } from "../../application/invite-redemptions.log-events.js";
import { RecordInviteeActivityUseCase } from "../../application/use-cases/record-invitee-activity.use-case.js";
import { INVITEE_ACTIVITY_QUEUE } from "../jobs/invitee-activity.queue.js";

type TodoCompletedPayload = z.infer<typeof todoChangedPayloadSchema>;

// 이름은 멱등 key(<eventId>:<name>)의 일부라 바꾸면 같은 완료가 다시 기록 대상이 된다
export const INVITEE_ACTIVITY_SUBSCRIPTION = defineEventSubscription({
  name: "social.invitee-activity",
  eventName: "planning.todo.completed",
  delivery: "durable",
  payloadSchema: todoChangedPayloadSchema,
  queue: INVITEE_ACTIVITY_QUEUE,
});

/**
 * planning.todo.completed를 초대 사용 시작 기록으로 넘긴다. 같은 작업이 다시 와도 활동일은 수락 행 잠금과
 * (수락, 날짜) 기본 키로 한 번만 남는다. 실패하면 기록하고 큐가 다시 보낸다.
 */
@Injectable()
export class InviteeActivityEventHandler implements OnModuleInit {
  readonly #logger = new Logger(InviteeActivityEventHandler.name);
  readonly #recordInviteeActivity: Pick<RecordInviteeActivityUseCase, "execute">;
  readonly #jobQueue: Pick<JobQueuePort, "work">;

  constructor(recordInviteeActivity: RecordInviteeActivityUseCase, jobQueue: JobQueuePort) {
    this.#recordInviteeActivity = recordInviteeActivity;
    this.#jobQueue = jobQueue;
  }

  async onModuleInit(): Promise<void> {
    await this.#jobQueue.work(INVITEE_ACTIVITY_QUEUE, async (jobs) => {
      for (const job of jobs) {
        await this.handle(job.data);
      }
    });
  }

  async handle(payload: TodoCompletedPayload): Promise<void> {
    try {
      // 처리 시각이 아니라 완료 시각으로 날짜를 정해 늦게 처리돼도 같은 활동일로 센다
      await this.#recordInviteeActivity.execute({
        inviteeId: payload.userId,
        occurredAt: Temporal.Instant.from(payload.occurredAt),
      });
    } catch (error) {
      this.#logger.warn({
        event: InviteRedemptionLogEvent.ACTIVITY_RECORD_FAILED,
        userId: payload.userId,
        errorType: toErrorType(error),
      });
      throw error;
    }
  }
}
