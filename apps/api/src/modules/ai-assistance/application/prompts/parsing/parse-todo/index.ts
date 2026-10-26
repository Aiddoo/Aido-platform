import { parseTodoPromptV1 } from "./v1/index.js";
import { parseTodoPromptV2 } from "./v2/index.js";

export type * from "./types.js";

/** 버전 폴더별 parse-todo 프롬프트 정의. env AI_PROMPT_VERSION_<TASK>로 고른다(기본 v2). */
export const parseTodoPrompts = {
  // TODO: 1.13.0 이전 앱 사용자가 업데이트한 뒤(v2 안정화 확인 후) v1 프롬프트 폴더와 전환 env를 제거한다
  v1: parseTodoPromptV1,
  v2: parseTodoPromptV2,
} as const;
