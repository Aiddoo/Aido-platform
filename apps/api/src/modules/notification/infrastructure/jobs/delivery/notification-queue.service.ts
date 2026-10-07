import { Inject, Injectable, Logger } from "@nestjs/common";

import { JOB_RUNTIME, type JobRuntimePort } from "#api/shared/application/ports/job-runtime.port";

import { NotificationProviderLogEvent } from "../../observability/delivery/notification-provider-log.events.js";
import {
  type BillingIssueJobData,
  type CheerSentJobData,
  type FollowMutualJobData,
  type FollowNewJobData,
  type FriendCompletedJobData,
  type MilestoneReachedJobData,
  NOTIFICATION_JOB_POLICY,
  NOTIFICATION_QUEUE,
  NotificationJobName,
  type NotificationRuntimeJob,
  type NudgeSentJobData,
} from "./notification-queue.constants.js";

@Injectable()
export class NotificationQueueService {
  readonly #logger = new Logger(NotificationQueueService.name);

  constructor(@Inject(JOB_RUNTIME) private readonly runtime: JobRuntimePort) {}

  /**
   * 새 팔로우 요청 알림 잡 등록
   */
  enqueueFollowNew(payload: FollowNewJobData): void {
    this.#enqueueAsync({ name: NotificationJobName.FOLLOW_NEW, data: payload }).catch(() => {
      this.#logger.error({ event: NotificationProviderLogEvent.ENQUEUE_FAILED });
    });
  }

  /**
   * 맞팔로우 성립 알림 잡 등록
   */
  enqueueFollowMutual(payload: FollowMutualJobData): void {
    this.#enqueueAsync({ name: NotificationJobName.FOLLOW_MUTUAL, data: payload }).catch(() => {
      this.#logger.error({ event: NotificationProviderLogEvent.ENQUEUE_FAILED });
    });
  }

  /**
   * Nudge 발송 알림 잡 등록
   */
  enqueueNudgeSent(payload: NudgeSentJobData): void {
    this.#enqueueAsync({ name: NotificationJobName.NUDGE_SENT, data: payload }).catch(() => {
      this.#logger.error({ event: NotificationProviderLogEvent.ENQUEUE_FAILED });
    });
  }

  /**
   * Cheer 발송 알림 잡 등록
   */
  enqueueCheerSent(payload: CheerSentJobData): void {
    this.#enqueueAsync({ name: NotificationJobName.CHEER_SENT, data: payload }).catch(() => {
      this.#logger.error({ event: NotificationProviderLogEvent.ENQUEUE_FAILED });
    });
  }

  /**
   * 결제 문제 알림 잡 등록
   */
  enqueueBillingIssue(payload: BillingIssueJobData): void {
    this.#enqueueAsync({ name: NotificationJobName.BILLING_ISSUE, data: payload }).catch(() => {
      this.#logger.error({ event: NotificationProviderLogEvent.ENQUEUE_FAILED });
    });
  }

  /**
   * 친구 할일 전체 완료 알림 잡 등록
   */
  enqueueFriendCompleted(payload: FriendCompletedJobData): void {
    this.#enqueueAsync({ name: NotificationJobName.FRIEND_COMPLETED, data: payload }).catch(() => {
      this.#logger.error({ event: NotificationProviderLogEvent.ENQUEUE_FAILED });
    });
  }

  /**
   * 마일스톤 달성 알림 잡 등록
   */
  enqueueMilestoneReached(payload: MilestoneReachedJobData): void {
    this.#enqueueAsync({ name: NotificationJobName.MILESTONE_REACHED, data: payload }).catch(() => {
      this.#logger.error({ event: NotificationProviderLogEvent.ENQUEUE_FAILED });
    });
  }

  async #enqueueAsync(
    job: Exclude<NotificationRuntimeJob, { name: typeof NotificationJobName.PUSH_RECEIPTS }>,
  ): Promise<void> {
    await this.runtime.enqueue(NOTIFICATION_QUEUE, job, this.#jobOptions());
    this.#logger.debug({ event: NotificationProviderLogEvent.JOB_ENQUEUED, jobName: job.name });
  }

  #jobOptions() {
    return NOTIFICATION_JOB_POLICY;
  }
}
