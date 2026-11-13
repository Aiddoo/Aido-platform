import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/application/application.exception";

import type { SuggestionId } from "../domain/suggestion-id.vo.js";

export function suggestionPremiumRequired(): ApplicationException {
  return new ApplicationException(ErrorCode.AI_1309);
}

export function suggestionCategoryRequired(): ApplicationException {
  return new ApplicationException(ErrorCode.SYS_0002, {
    field: "categoryId",
    reason: "수락 시 categoryId는 필수입니다",
  });
}

export function invalidSuggestionDaysOfWeek(): ApplicationException {
  return new ApplicationException(ErrorCode.SYS_0002, {
    field: "daysOfWeek",
    reason: "제안의 요일 데이터가 유효하지 않습니다",
  });
}

export function suggestionNotFound(suggestionId: SuggestionId): ApplicationException {
  return new ApplicationException(ErrorCode.AI_1305, { suggestionId: suggestionId.value });
}
