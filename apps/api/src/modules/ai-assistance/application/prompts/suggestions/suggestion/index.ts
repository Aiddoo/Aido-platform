import { suggestionPromptV1 } from "./v1/index.js";
import { suggestionPromptV2 } from "./v2/index.js";

export type * from "./types.js";

/** 버전 폴더별 반복 제안 프롬프트 정의. env AI_PROMPT_VERSION_SUGGESTION으로 고른다(기본 v2). */
export const suggestionPrompts = {
  // TODO: 1.13.0 이전 앱 사용자가 업데이트한 뒤(v2 안정화 확인 후) v1 프롬프트 폴더와 전환 env를 제거한다
  v1: suggestionPromptV1,
  v2: suggestionPromptV2,
} as const;
