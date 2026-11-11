import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/application/application.exception";

import type { SuggestionId } from "../domain/suggestion-id.vo.js";

export function suggestionNotFound(suggestionId: SuggestionId): ApplicationException {
  return new ApplicationException(ErrorCode.AI_1305, { suggestionId: suggestionId.value });
}
