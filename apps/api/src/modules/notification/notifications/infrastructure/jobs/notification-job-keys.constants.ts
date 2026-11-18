import { match } from "ts-pattern";

import { instantFromDate } from "#api/shared/domain/time/instant";
import { localDateIn } from "#api/shared/domain/time/time-zone-name";

import { NotificationJobName, type NotificationRuntimeJob } from "./notification.queue.js";

/**
 * pg-boss는 같은 key의 작업을 결정적 id로 한 번만 저장한다. key는 원인 이벤트 하나를 가리켜
 * 같은 이벤트의 재발행만 막고 다른 이벤트는 막지 않는다.
 */
export function notificationEventJobKey(
  job: Exclude<NotificationRuntimeJob, { name: typeof NotificationJobName.PUSH_RECEIPTS }>,
  occurredAt: Date,
): string {
  return match(job)
    .with(
      { name: NotificationJobName.FOLLOW_NEW },
      ({ data }) => `follow-new-${data.followerId}-${data.followingId}`,
    )
    .with(
      { name: NotificationJobName.FOLLOW_MUTUAL },
      ({ data }) => `follow-mutual-${data.userId}-${data.friendId}`,
    )
    .with({ name: NotificationJobName.NUDGE_SENT }, ({ data }) => `nudge-${data.nudgeId}`)
    .with({ name: NotificationJobName.CHEER_SENT }, ({ data }) => `cheer-${data.cheerId}`)
    .with(
      { name: NotificationJobName.BILLING_ISSUE },
      ({ data }) =>
        `billing-issue-${data.userId}-${localDateIn(instantFromDate(occurredAt), "UTC").toString()}`,
    )
    .with(
      { name: NotificationJobName.FRIEND_COMPLETED },
      ({ data }) =>
        `friend-completed-${data.friendId}-${localDateIn(instantFromDate(occurredAt), data.timezone).toString()}`,
    )
    .with(
      { name: NotificationJobName.MILESTONE_REACHED },
      ({ data }) => `milestone-${data.userId}-${data.milestone}`,
    )
    .exhaustive();
}
