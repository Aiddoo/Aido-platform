import { z } from "zod";

import { JOB_SCHEDULE_TIMEZONE } from "#api/shared/application/job-schedule-timezone";
import { defineQueue, JOB_POLLING_SECONDS } from "#api/shared/application/ports/job-queue.port";
import { toIsoString } from "#api/shared/domain/time/instant";
import { DAY_SECONDS } from "#api/shared/domain/time/time-units";

import type { InviteRewardTrigger } from "../../application/ports/invite-reward-scheduler.port.js";
import type { InviteRedemptionId } from "../../domain/invite-redemption-id.vo.js";

// 큐 재시도는 짧은 장애만 넘기고(30초·60초) 긴 장애는 하루 한 번 정비 재시도가 이어 받는다.
// 보상은 몇 초 늦어도 체감되지 않아 배경 주기로 처리한다
export const INVITE_REWARD_QUEUE = defineQueue({
  name: "invite-reward.v1",
  payloadSchema: z.object({ redemptionId: z.string().min(1) }),
  retry: {
    retryLimit: 2,
    retryDelaySeconds: 30,
    retryBackoff: true,
    expireInSeconds: 5 * 60,
    retentionSeconds: 7 * DAY_SECONDS,
    deleteAfterSeconds: 7 * DAY_SECONDS,
  },
  worker: { localConcurrency: 2, pollingIntervalSeconds: JOB_POLLING_SECONDS.BACKGROUND },
});

export const InviteRewardJobKey = {
  of(redemptionId: InviteRedemptionId, trigger: InviteRewardTrigger): string {
    // 이미 쌓인 job key와 같게 재시도 날짜는 YYYY-MM-DD다
    const suffix = trigger.kind === "retry" ? `retry:${trigger.runDate.toString()}` : trigger.kind;
    return `invite-reward:${redemptionId.value}:${suffix}`;
  },
};

export const INVITE_MAINTENANCE_JOB_NAME = "expire-stale-redemptions";

/**
 * 사용 시작 알림은 새 큐·worker 없이 정비 큐에 발송 시각(startAfter)을 둔 작업으로 넣는다. 정비 작업 payload와
 * 같은 `{ name, data }` 모양이라 processor가 name으로 나눈다.
 */
export const INVITE_QUALIFY_REMINDER_JOB_NAME = "send-qualify-reminder";

export const INVITE_MAINTENANCE_SCHEDULE = {
  timezone: JOB_SCHEDULE_TIMEZONE,
  catchUpHour: 3,
} as const;

export const INVITE_MAINTENANCE_QUEUE = defineQueue({
  name: "invite-maintenance.v1",
  payloadSchema: z.union([
    z.object({
      name: z.literal(INVITE_QUALIFY_REMINDER_JOB_NAME),
      data: z.object({ redemptionId: z.string().min(1) }),
    }),
    // 등록된 일정·catch-up과 name이 없던 옛 payload는 모두 정비 실행이다
    z.object({ name: z.literal(INVITE_MAINTENANCE_JOB_NAME).optional() }),
  ]),
  retry: {
    retryLimit: 2,
    retryDelaySeconds: 60,
    retryBackoff: true,
    expireInSeconds: 30 * 60,
    retentionSeconds: 7 * DAY_SECONDS,
    deleteAfterSeconds: DAY_SECONDS,
  },
  worker: { localConcurrency: 1, pollingIntervalSeconds: JOB_POLLING_SECONDS.BACKGROUND },
  schedules: [
    {
      key: "daily-invite-maintenance-scheduler",
      cron: "30 3 * * *",
      timezone: JOB_SCHEDULE_TIMEZONE,
      missed: "skip",
      payload: { name: INVITE_MAINTENANCE_JOB_NAME },
    },
  ],
});

export type InviteMaintenanceJobPayload = z.infer<typeof INVITE_MAINTENANCE_QUEUE.payloadSchema>;

export const InviteMaintenanceJobKey = {
  catchUp: (runDate: Temporal.PlainDate): string => `invite-maintenance_${runDate.toString()}`,
};

export const InviteQualifyReminderJobKey = {
  // 같은 수락의 같은 발송 시각은 정비 작업을 다시 돌려도 작업 하나로 합친다
  of: (redemptionId: InviteRedemptionId, sendAt: Temporal.Instant): string =>
    `invite-qualify-reminder:${redemptionId.value}:${toIsoString(sendAt)}`,
};
