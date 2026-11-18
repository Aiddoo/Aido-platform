import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/application/application.exception";

export function weeklyAchievementNotFound(week: {
  readonly year: number;
  readonly week: number;
}): ApplicationException {
  return new ApplicationException(ErrorCode.ACHIEVEMENT_1801, {
    year: week.year,
    week: week.week,
  });
}

/** 시퀀스가 기록 수보다 적은 id를 돌려줬다(생기면 버그다) */
export function weeklyAchievementIdsMissing(): ApplicationException {
  return new ApplicationException(ErrorCode.SYS_0001, {
    detail: "Sequence returned fewer weekly achievement ids than tallies",
  });
}
