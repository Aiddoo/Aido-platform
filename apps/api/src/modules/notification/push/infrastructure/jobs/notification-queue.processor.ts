import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { match } from "ts-pattern";

import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";

import { ReconcilePushReceiptsUseCase } from "../../application/use-cases/reconcile-push-receipts.use-case.js";
import { SendBillingIssueNotificationUseCase } from "../../application/use-cases/send-billing-issue-notification.use-case.js";
import { SendCheerNotificationUseCase } from "../../application/use-cases/send-cheer-notification.use-case.js";
import { SendFollowAcceptedNotificationUseCase } from "../../application/use-cases/send-follow-accepted-notification.use-case.js";
import { SendFollowRequestNotificationUseCase } from "../../application/use-cases/send-follow-request-notification.use-case.js";
import { SendFriendCompletionNotificationsUseCase } from "../../application/use-cases/send-friend-completion-notifications.use-case.js";
import { SendMilestoneNotificationUseCase } from "../../application/use-cases/send-milestone-notification.use-case.js";
import { SendNudgeNotificationUseCase } from "../../application/use-cases/send-nudge-notification.use-case.js";
import { NotificationProviderLogEvent } from "../adapters/notification-provider.log-events.js";
import {
  NOTIFICATION_DEAD_LETTER_QUEUE,
  NOTIFICATION_QUEUE,
  NotificationJobName,
  type NotificationRuntimeJob,
} from "./notification.queue.js";

@Injectable()
export class NotificationQueueProcessor implements OnModuleInit {
  readonly #logger = new Logger(NotificationQueueProcessor.name);

  readonly #sendFollowRequest: Pick<SendFollowRequestNotificationUseCase, "execute">;
  readonly #sendFollowAccepted: Pick<SendFollowAcceptedNotificationUseCase, "execute">;
  readonly #sendNudge: Pick<SendNudgeNotificationUseCase, "execute">;
  readonly #sendCheer: Pick<SendCheerNotificationUseCase, "execute">;
  readonly #sendBillingIssue: Pick<SendBillingIssueNotificationUseCase, "execute">;
  readonly #sendFriendCompletion: Pick<SendFriendCompletionNotificationsUseCase, "execute">;
  readonly #sendMilestone: Pick<SendMilestoneNotificationUseCase, "execute">;
  readonly #reconcilePushReceipts: Pick<ReconcilePushReceiptsUseCase, "execute">;
  readonly #jobQueue: JobQueuePort;

  constructor(
    @Inject(SendFollowRequestNotificationUseCase) sendFollowRequest: Pick<
      SendFollowRequestNotificationUseCase,
      "execute"
    >,
    @Inject(SendFollowAcceptedNotificationUseCase) sendFollowAccepted: Pick<
      SendFollowAcceptedNotificationUseCase,
      "execute"
    >,
    @Inject(SendNudgeNotificationUseCase) sendNudge: Pick<SendNudgeNotificationUseCase, "execute">,
    @Inject(SendCheerNotificationUseCase) sendCheer: Pick<SendCheerNotificationUseCase, "execute">,
    @Inject(SendBillingIssueNotificationUseCase) sendBillingIssue: Pick<
      SendBillingIssueNotificationUseCase,
      "execute"
    >,
    @Inject(SendFriendCompletionNotificationsUseCase) sendFriendCompletion: Pick<
      SendFriendCompletionNotificationsUseCase,
      "execute"
    >,
    @Inject(SendMilestoneNotificationUseCase) sendMilestone: Pick<
      SendMilestoneNotificationUseCase,
      "execute"
    >,
    @Inject(ReconcilePushReceiptsUseCase) reconcilePushReceipts: Pick<
      ReconcilePushReceiptsUseCase,
      "execute"
    >,
    jobQueue: JobQueuePort,
  ) {
    this.#sendFollowRequest = sendFollowRequest;
    this.#sendFollowAccepted = sendFollowAccepted;
    this.#sendNudge = sendNudge;
    this.#sendCheer = sendCheer;
    this.#sendBillingIssue = sendBillingIssue;
    this.#sendFriendCompletion = sendFriendCompletion;
    this.#sendMilestone = sendMilestone;
    this.#reconcilePushReceipts = reconcilePushReceipts;
    this.#jobQueue = jobQueue;
  }

  async onModuleInit(): Promise<void> {
    await this.#jobQueue.work(NOTIFICATION_QUEUE, async (jobs) => {
      for (const job of jobs) {
        await this.process(job.data);
      }
    });
    await this.#jobQueue.work(NOTIFICATION_DEAD_LETTER_QUEUE, async (jobs) => {
      for (const job of jobs) {
        this.recordDeadLetter(job.data);
      }
    });
  }

  /** 재시도를 다 쓴 알림 이벤트는 다시 보내지 않는다. 늦은 소셜 알림은 의미가 없어 기록만 남긴다. */
  recordDeadLetter(job: NotificationRuntimeJob): void {
    this.#logger.error({
      event: NotificationProviderLogEvent.JOB_DEAD_LETTERED,
      jobName: job.name,
    });
  }

  async process(job: NotificationRuntimeJob): Promise<void> {
    return match(job)
      .with({ name: NotificationJobName.FOLLOW_NEW }, ({ data }) =>
        this.#sendFollowRequest.execute(data),
      )
      .with({ name: NotificationJobName.FOLLOW_MUTUAL }, ({ data }) =>
        this.#sendFollowAccepted.execute(data),
      )
      .with({ name: NotificationJobName.NUDGE_SENT }, ({ data }) => this.#sendNudge.execute(data))
      .with({ name: NotificationJobName.CHEER_SENT }, ({ data }) => this.#sendCheer.execute(data))
      .with({ name: NotificationJobName.BILLING_ISSUE }, ({ data }) =>
        this.#sendBillingIssue.execute(data),
      )
      .with({ name: NotificationJobName.FRIEND_COMPLETED }, ({ data }) =>
        this.#sendFriendCompletion.execute(data),
      )
      .with({ name: NotificationJobName.MILESTONE_REACHED }, ({ data }) =>
        this.#sendMilestone.execute(data),
      )
      .with({ name: NotificationJobName.PUSH_RECEIPTS }, () =>
        this.#reconcilePushReceipts.execute(),
      )
      .exhaustive();
  }
}
