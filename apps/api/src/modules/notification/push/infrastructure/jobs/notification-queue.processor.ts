import { Inject, Injectable, Logger, type OnModuleInit, Optional } from "@nestjs/common";
import { match } from "ts-pattern";

import { JOB_RUNTIME, type JobRuntimePort } from "#api/shared/application/ports/index";

import { ReconcilePushReceipts } from "../../application/use-cases/reconcile-push-receipts.use-case.js";
import { SendBillingIssueNotification } from "../../application/use-cases/send-billing-issue-notification.use-case.js";
import { SendCheerNotification } from "../../application/use-cases/send-cheer-notification.use-case.js";
import { SendFollowAcceptedNotification } from "../../application/use-cases/send-follow-accepted-notification.use-case.js";
import { SendFollowRequestNotification } from "../../application/use-cases/send-follow-request-notification.use-case.js";
import { SendFriendCompletionNotifications } from "../../application/use-cases/send-friend-completion-notifications.use-case.js";
import { SendMilestoneNotification } from "../../application/use-cases/send-milestone-notification.use-case.js";
import { SendNudgeNotification } from "../../application/use-cases/send-nudge-notification.use-case.js";
import { NotificationProviderLogEvent } from "../adapters/notification-provider.log-events.js";
import {
  NOTIFICATION_DEAD_LETTER_QUEUE,
  NOTIFICATION_DEAD_LETTER_WORKER_POLICY,
  NOTIFICATION_QUEUE,
  NOTIFICATION_WORKER_POLICY,
  NotificationJobName,
  NotificationRuntimeJobSchema,
} from "./notification-queue.constants.js";

@Injectable()
export class NotificationQueueProcessor implements OnModuleInit {
  readonly #logger = new Logger(NotificationQueueProcessor.name);

  readonly #sendFollowRequest: SendFollowRequestNotification;
  readonly #sendFollowAccepted: SendFollowAcceptedNotification;
  readonly #sendNudge: SendNudgeNotification;
  readonly #sendCheer: SendCheerNotification;
  readonly #sendBillingIssue: SendBillingIssueNotification;
  readonly #sendFriendCompletion: SendFriendCompletionNotifications;
  readonly #sendMilestone: SendMilestoneNotification;
  readonly #reconcilePushReceipts: ReconcilePushReceipts;
  readonly #runtime: JobRuntimePort | undefined;

  constructor(
    sendFollowRequest: SendFollowRequestNotification,
    sendFollowAccepted: SendFollowAcceptedNotification,
    sendNudge: SendNudgeNotification,
    sendCheer: SendCheerNotification,
    sendBillingIssue: SendBillingIssueNotification,
    sendFriendCompletion: SendFriendCompletionNotifications,
    sendMilestone: SendMilestoneNotification,
    reconcilePushReceipts: ReconcilePushReceipts,
    @Optional()
    @Inject(JOB_RUNTIME)
    runtime?: JobRuntimePort,
  ) {
    this.#sendFollowRequest = sendFollowRequest;
    this.#sendFollowAccepted = sendFollowAccepted;
    this.#sendNudge = sendNudge;
    this.#sendCheer = sendCheer;
    this.#sendBillingIssue = sendBillingIssue;
    this.#sendFriendCompletion = sendFriendCompletion;
    this.#sendMilestone = sendMilestone;
    this.#reconcilePushReceipts = reconcilePushReceipts;
    this.#runtime = runtime;
  }

  async onModuleInit(): Promise<void> {
    if (!this.#runtime) {
      return;
    }

    await this.#runtime.work(
      NOTIFICATION_QUEUE,
      async (jobs) => {
        for (const job of jobs) {
          await this.process(job.data);
        }
      },
      NOTIFICATION_WORKER_POLICY,
    );
    await this.#runtime.work(
      NOTIFICATION_DEAD_LETTER_QUEUE,
      async (jobs) => {
        for (const job of jobs) {
          this.recordDeadLetter(job.data);
        }
      },
      NOTIFICATION_DEAD_LETTER_WORKER_POLICY,
    );
  }

  /** 재시도를 다 쓴 알림 이벤트는 다시 보내지 않는다. 늦은 소셜 알림은 의미가 없어 기록만 남긴다. */
  recordDeadLetter(untrustedJob: unknown): void {
    const parsed = NotificationRuntimeJobSchema.safeParse(untrustedJob);
    this.#logger.error({
      event: NotificationProviderLogEvent.JOB_DEAD_LETTERED,
      jobName: parsed.success ? parsed.data.name : "invalid",
    });
  }

  async process(untrustedJob: unknown): Promise<void> {
    const job = NotificationRuntimeJobSchema.parse(untrustedJob);

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
