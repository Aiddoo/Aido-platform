import { z } from "zod";

import {
  type EnqueueJobOptions,
  JOB_POLLING_SECONDS,
  type WorkJobOptions,
} from "#api/shared/application/ports/job-runtime.port";

import type { InviteRewardTrigger } from "../../../application/ports/invites/invite-reward.scheduler.port.js";

export const INVITE_REWARD_QUEUE = "invite-reward.v1";

export const inviteRewardJobDataSchema = z.object({ redemptionId: z.string().min(1) });
export type InviteRewardJobData = z.infer<typeof inviteRewardJobDataSchema>;

// 큐 재시도는 짧은 장애만 넘기고(30초·60초) 긴 장애는 하루 한 번 정비 재시도가 이어 받는다
export const INVITE_REWARD_JOB_OPTIONS = {
  retryLimit: 2,
  retryDelaySeconds: 30,
  retryBackoff: true,
  expireInSeconds: 5 * 60,
  retentionSeconds: 7 * 24 * 60 * 60,
  deleteAfterSeconds: 7 * 24 * 60 * 60,
} satisfies EnqueueJobOptions;

// 보상은 몇 초 늦어도 체감되지 않아 배경 주기로 처리한다
export const INVITE_REWARD_WORKER_OPTIONS = {
  teamSize: 2,
  pollingIntervalSeconds: JOB_POLLING_SECONDS.BACKGROUND,
  queuePolicy: INVITE_REWARD_JOB_OPTIONS,
} satisfies WorkJobOptions;

export const InviteRewardJobKey = {
  of(redemptionId: string, trigger: InviteRewardTrigger): string {
    const suffix = trigger.kind === "retry" ? `retry:${trigger.localDate}` : trigger.kind;
    return `invite-reward:${redemptionId}:${suffix}`;
  },
};

export const INVITE_MAINTENANCE_QUEUE = "invite-maintenance.v1";
export const INVITE_MAINTENANCE_JOB_NAME = "expire-stale-redemptions";
export type InviteMaintenanceJobData = Record<string, never>;

export const INVITE_MAINTENANCE_SCHEDULE = {
  id: "daily-invite-maintenance-scheduler",
  cron: "30 3 * * *",
  timezone: "Asia/Seoul",
  catchUpHour: 3,
};

export const INVITE_MAINTENANCE_JOB_OPTIONS = {
  retryLimit: 2,
  retryDelaySeconds: 60,
  retryBackoff: true,
  expireInSeconds: 30 * 60,
  retentionSeconds: 7 * 24 * 60 * 60,
  deleteAfterSeconds: 24 * 60 * 60,
  timezone: INVITE_MAINTENANCE_SCHEDULE.timezone,
} satisfies EnqueueJobOptions;

export const InviteMaintenanceJobKey = {
  catchUp: (localDate: string): string => `invite-maintenance_${localDate}`,
};
