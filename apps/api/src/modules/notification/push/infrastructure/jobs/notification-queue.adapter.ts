import { Injectable, Logger } from "@nestjs/common";

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
 * 다른 Context가 알림 이벤트를 넘기는 입구다. 활성 트랜잭션이 있으면 호출자의 변경과 함께 커밋되고(같은 DB의
 * 작업 표가 아웃박스다), 실패는 호출자에게 던진다. 같은 이벤트는 key로 한 번만 저장한다.
 */
@Injectable()
export class NotificationQueueAdapter {
  readonly #logger = new Logger(NotificationQueueAdapter.name);

  readonly #jobQueue: JobQueuePort;
  readonly #clock: ClockPort;

  constructor(jobQueue: JobQueuePort, clock: ClockPort) {
    this.#jobQueue = jobQueue;
    this.#clock = clock;
  }

  enqueueFollowNew(data: FollowNewJobData): Promise<void> {
    return this.#enqueueNow({ name: NotificationJobName.FOLLOW_NEW, data });
  }

  enqueueFollowMutual(data: FollowMutualJobData): Promise<void> {
    return this.#enqueueNow({ name: NotificationJobName.FOLLOW_MUTUAL, data });
  }

  enqueueNudgeSent(data: NudgeSentJobData): Promise<void> {
    return this.#enqueueNow({ name: NotificationJobName.NUDGE_SENT, data });
  }

  enqueueCheerSent(data: CheerSentJobData): Promise<void> {
    return this.#enqueueNow({ name: NotificationJobName.CHEER_SENT, data });
  }

  enqueueBillingIssue(data: BillingIssueJobData, occurredAt: Temporal.Instant): Promise<void> {
    return this.#enqueue(
      { name: NotificationJobName.BILLING_ISSUE, data },
      instantToDate(occurredAt),
    );
  }

  enqueueFriendCompleted(data: FriendCompletedJobData): Promise<void> {
    return this.#enqueueNow({ name: NotificationJobName.FRIEND_COMPLETED, data });
  }

  enqueueMilestoneReached(data: MilestoneReachedJobData): Promise<void> {
    return this.#enqueueNow({ name: NotificationJobName.MILESTONE_REACHED, data });
  }

  #enqueueNow(job: NotificationEventJob): Promise<void> {
    return this.#enqueue(job, instantToDate(this.#clock.now()));
  }

  async #enqueue(job: NotificationEventJob, occurredAt: Date): Promise<void> {
    await this.#jobQueue.enqueue(NOTIFICATION_QUEUE, job, {
      idempotencyKey: notificationEventJobKey(job, occurredAt),
    });
    this.#logger.debug({ event: NotificationProviderLogEvent.JOB_ENQUEUED, jobName: job.name });
  }
}
