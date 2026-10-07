import { Inject, Injectable, type OnModuleInit, Optional } from "@nestjs/common";

import {
  JOB_RUNTIME,
  type JobData,
  type JobRuntimePort,
} from "#api/shared/application/ports/index";

import { ReconcilePushReceipts } from "../../../application/use-cases/delivery/reconcile-push-receipts.use-case.js";
import { SendBillingIssueNotification } from "../../../application/use-cases/delivery/send-billing-issue-notification.use-case.js";
import { SendCheerNotification } from "../../../application/use-cases/delivery/send-cheer-notification.use-case.js";
import { SendFollowAcceptedNotification } from "../../../application/use-cases/delivery/send-follow-accepted-notification.use-case.js";
import { SendFollowRequestNotification } from "../../../application/use-cases/delivery/send-follow-request-notification.use-case.js";
import { SendFriendCompletionNotifications } from "../../../application/use-cases/delivery/send-friend-completion-notifications.use-case.js";
import { SendMilestoneNotification } from "../../../application/use-cases/delivery/send-milestone-notification.use-case.js";
import { SendNudgeNotification } from "../../../application/use-cases/delivery/send-nudge-notification.use-case.js";
import {
  NOTIFICATION_LEGACY_QUEUE,
  NOTIFICATION_QUEUE,
  NOTIFICATION_WORKER_POLICY,
  NotificationJobName,
  NotificationRuntimeJobSchema,
} from "./notification-queue.constants.js";

function assertUnreachableJob(job: never): never {
  throw new Error(`Unhandled notification job: ${JSON.stringify(job)}`);
}

/** Queue adapter: validates transport input and routes it to application use cases. */
@Injectable()
export class NotificationQueueProcessor implements OnModuleInit {
  constructor(
    private readonly sendFollowRequest: SendFollowRequestNotification,
    private readonly sendFollowAccepted: SendFollowAcceptedNotification,
    private readonly sendNudge: SendNudgeNotification,
    private readonly sendCheer: SendCheerNotification,
    private readonly sendBillingIssue: SendBillingIssueNotification,
    private readonly sendFriendCompletion: SendFriendCompletionNotifications,
    private readonly sendMilestone: SendMilestoneNotification,
    private readonly reconcilePushReceipts: ReconcilePushReceipts,
    @Optional()
    @Inject(JOB_RUNTIME)
    private readonly runtime?: JobRuntimePort,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.runtime) return;

    await this.runtime.work<JobData>(
      NOTIFICATION_QUEUE,
      async (jobs) => {
        for (const job of jobs) await this.process(job.data);
      },
      NOTIFICATION_WORKER_POLICY,
    );
    await this.runtime.work<JobData>(
      NOTIFICATION_LEGACY_QUEUE,
      async (jobs) => {
        for (const job of jobs) {
          await this.process({ name: job.name, data: job.data });
        }
      },
      NOTIFICATION_WORKER_POLICY,
    );
  }

  async process(untrustedJob: unknown): Promise<void> {
    const job = NotificationRuntimeJobSchema.parse(untrustedJob);

    switch (job.name) {
      case NotificationJobName.FOLLOW_NEW:
        return this.sendFollowRequest.execute(job.data);
      case NotificationJobName.FOLLOW_MUTUAL:
        return this.sendFollowAccepted.execute(job.data);
      case NotificationJobName.NUDGE_SENT:
        return this.sendNudge.execute(job.data);
      case NotificationJobName.CHEER_SENT:
        return this.sendCheer.execute(job.data);
      case NotificationJobName.BILLING_ISSUE:
        return this.sendBillingIssue.execute(job.data);
      case NotificationJobName.FRIEND_COMPLETED:
        return this.sendFriendCompletion.execute(job.data);
      case NotificationJobName.MILESTONE_REACHED:
        return this.sendMilestone.execute(job.data);
      case NotificationJobName.PUSH_RECEIPTS:
        return this.reconcilePushReceipts.execute();
    }

    return assertUnreachableJob(job);
  }
}
