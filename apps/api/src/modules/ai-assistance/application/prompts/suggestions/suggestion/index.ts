import { suggestionPromptV1 } from "./v1/index.js";

export type * from "./types.js";

/** 버전 폴더별 반복 제안 프롬프트 정의 */
export const suggestionPrompts = {
  v1: suggestionPromptV1,
} as const;
