import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/application/application.exception";

import type { IsoWeek } from "../domain/iso-week.vo.js";

export function weeklyAchievementNotFound(isoWeek: IsoWeek): ApplicationException {
  return new ApplicationException(ErrorCode.ACHIEVEMENT_1801, {
    year: isoWeek.year,
    week: isoWeek.week,
  });
}

/** 시퀀스가 기록 수보다 적은 id를 돌려줬다(생기면 버그다) */
export function weeklyAchievementIdsMissing(): ApplicationException {
  return new ApplicationException(ErrorCode.SYS_0001, {
    detail: "Sequence returned fewer weekly achievement ids than tallies",
  });
}
