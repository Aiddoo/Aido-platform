import { addDays } from "#api/shared/domain/date/utils/arithmetic";

/** 결제·보상 기간이 끝나기 며칠 전에 한 번 보내는 안내의 기간 규칙. 하루는 UTC 24시간이다. */
export const BillingNoticeWindowPolicy = {
  /** 이 시각 이전에 끝나는 기간을 지금 안내한다. */
  noticeUntil(now: Date, days: number): Date {
    return addDays(days, now);
  },

  /** 시작할 때 이미 안내 기간 안이었던 기간(재설치·짧은 체험)은 시작 직후 알림이 되므로 보내지 않는다. */
  isNoticeable(startedAt: Date, endsAt: Date, days: number): boolean {
    return endsAt.getTime() > addDays(days, startedAt).getTime();
  },
};
