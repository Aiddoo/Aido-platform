import { Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import { retry } from "es-toolkit";

import { ClockPort } from "#api/shared/application/ports/clock.port";
import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";
import { instantToDate } from "#api/shared/domain/time/instant";

import { NotificationProviderLogEvent } from "../adapters/notification-provider.log-events.js";
import { notificationEventJobKey } from "./notification-job-keys.constants.js";
import {
  type BillingIssueJobData,
  type CheerSentJobData,
  type FollowMutualJobData,
  type FollowNewJobData,
  type FriendCompletedJobData,
  type MilestoneReachedJobData,
  NOTIFICATION_ENQUEUE_RETRY,
  NOTIFICATION_QUEUE,
  NotificationJobName,
  type NotificationRuntimeJob,
  type NudgeSentJobData,
} from "./notification.queue.js";

type NotificationEventJob = Exclude<
  NotificationRuntimeJob,
  { name: typeof NotificationJobName.PUSH_RECEIPTS }
>;

/**
 * 다른 Context가 커밋 뒤 알림 이벤트를 넘기는 입구다. 호출자를 막지 않도록 결과를 기다리지 않는 대신
 * 같은 이벤트는 key로 한 번만 저장하고, 일시적인 저장 실패는 다시 시도한 뒤 오류로 남긴다.
 */
@Injectable()
export class NotificationQueueAdapter implements OnModuleDestroy {
  readonly #logger = new Logger(NotificationQueueAdapter.name);
  readonly #inFlight = new Set<Promise<void>>();

  readonly #jobQueue: JobQueuePort;
  readonly #clock: ClockPort;

  constructor(jobQueue: JobQueuePort, clock: ClockPort) {
    this.#jobQueue = jobQueue;
    this.#clock = clock;
  }

  enqueueFollowNew(data: FollowNewJobData): void {
    this.#enqueueDetached({ name: NotificationJobName.FOLLOW_NEW, data });
  }

  enqueueFollowMutual(data: FollowMutualJobData): void {
    this.#enqueueDetached({ name: NotificationJobName.FOLLOW_MUTUAL, data });
  }

  enqueueNudgeSent(data: NudgeSentJobData): void {
    this.#enqueueDetached({ name: NotificationJobName.NUDGE_SENT, data });
  }

  enqueueCheerSent(data: CheerSentJobData): void {
    this.#enqueueDetached({ name: NotificationJobName.CHEER_SENT, data });
  }

  /** 활성 트랜잭션이 있으면 호출자의 변경과 함께 커밋된다. 실패는 호출자에게 던진다. */
  enqueueBillingIssue(data: BillingIssueJobData, occurredAt: Temporal.Instant): Promise<void> {
    return this.#enqueue(
      { name: NotificationJobName.BILLING_ISSUE, data },
      instantToDate(occurredAt),
    );
  }

  enqueueFriendCompleted(data: FriendCompletedJobData): void {
    this.#enqueueDetached({ name: NotificationJobName.FRIEND_COMPLETED, data });
  }

  enqueueMilestoneReached(data: MilestoneReachedJobData): void {
    this.#enqueueDetached({ name: NotificationJobName.MILESTONE_REACHED, data });
  }

  /** job runtime이 멈추기 전에 아직 저장 중인 이벤트를 끝낸다. */
  async onModuleDestroy(): Promise<void> {
    await Promise.allSettled(this.#inFlight);
  }

  async #enqueue(job: NotificationEventJob, occurredAt: Date): Promise<void> {
    await this.#jobQueue.enqueue(NOTIFICATION_QUEUE, job, {
      idempotencyKey: notificationEventJobKey(job, occurredAt),
    });
    this.#logger.debug({ event: NotificationProviderLogEvent.JOB_ENQUEUED, jobName: job.name });
  }

  #enqueueDetached(job: NotificationEventJob): void {
    const occurredAt = instantToDate(this.#clock.now());
    const pending = retry(() => this.#enqueue(job, occurredAt), {
      retries: NOTIFICATION_ENQUEUE_RETRY.retries,
      delay: NOTIFICATION_ENQUEUE_RETRY.delayMs,
    })
      .catch((error: unknown) => {
        this.#logger.error({
          event: NotificationProviderLogEvent.ENQUEUE_FAILED,
          jobName: job.name,
          errorType: error instanceof Error ? error.name : "UnknownError",
        });
      })
      .finally(() => {
        this.#inFlight.delete(pending);
      });
    this.#inFlight.add(pending);
  }
}
