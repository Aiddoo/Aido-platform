import { PREMIUM_TRIAL_ENDING_NOTICE_DAYS } from "@aido/api/vocabulary";

import { addDays } from "#api/shared/domain/date/utils/arithmetic";

/** 체험 종료 안내에 필요한 스토어 구독 값. 끝나는 시각은 스토어 expiration_at_ms 그대로다. */
export interface TrialPeriod {
  readonly startedAt: Date;
  readonly expiresAt: Date;
}

export const TrialEndingNoticePolicy = {
  /** 이 시각 이전에 끝나는 체험을 지금 안내한다. */
  noticeUntil(now: Date): Date {
    return addDays(PREMIUM_TRIAL_ENDING_NOTICE_DAYS, now);
  },

  /** 시작할 때 이미 안내 기간 안이었던 체험(재설치·짧은 체험)은 시작 직후 알림이 되므로 보내지 않는다. */
  isNoticeable(trial: TrialPeriod): boolean {
    return (
      trial.expiresAt.getTime() >
      addDays(PREMIUM_TRIAL_ENDING_NOTICE_DAYS, trial.startedAt).getTime()
    );
  },
};
