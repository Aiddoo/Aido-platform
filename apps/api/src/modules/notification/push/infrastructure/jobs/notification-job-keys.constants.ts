import { createHash } from "node:crypto";

import { sortBy } from "es-toolkit";
import { match } from "ts-pattern";

import { toDateString } from "#api/shared/domain/date/utils/format";
import { resolveTimezone } from "#api/shared/domain/date/utils/timezone";
import { instantFromDate } from "#api/shared/domain/time/instant";
import { TimeZone } from "#api/shared/domain/time/time-zone.vo";
import { localDateOf } from "#api/shared/domain/time/zoned-time";

import type { PushDeliveryPublication } from "../../application/read-models/push-delivery.read-model.js";
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
      ({ data }) => `billing-issue-${data.userId}-${toDateString(occurredAt)}`,
    )
    .with(
      { name: NotificationJobName.FRIEND_COMPLETED },
      ({ data }) =>
        `friend-completed-${data.friendId}-${localDateOf(instantFromDate(occurredAt), TimeZone.reconstitute(resolveTimezone(data.timezone))).toString()}`,
    )
    .with(
      { name: NotificationJobName.MILESTONE_REACHED },
      ({ data }) => `milestone-${data.userId}-${data.milestone}`,
    )
    .exhaustive();
}

export function pushDeliveryJobKey(publications: readonly PushDeliveryPublication[]): string {
  const generation = sortBy(publications, ["dispatchId", "publishAttempt"])
    .map((item) => `${item.dispatchId}-${item.publishAttempt}`)
    .join(".");
  return `push-delivery-${createHash("sha256").update(generation).digest("hex")}`;
}

/** 이전 배포가 예약한 작업을 같은 key로 취소해야 하므로 형식을 바꾸지 않는다. */
export function todoReminderJobKey(todoId: number, stageLabel: string): string {
  return `reminder_${todoId}_${stageLabel}`;
}

/** 휴면 기간 하나에 안내 하나. dormantSince는 그 기간의 마지막 활동일이다. */
export function todoSeriesPausedJobKey(userId: string, dormantSince: string): string {
  return `series-paused_${userId}_${dormantSince}`;
}
