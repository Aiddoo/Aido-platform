import { reportPromptV1 } from "./v1/index.js";
import { reportPromptV2 } from "./v2/index.js";

export type * from "./types.js";

/** 버전 폴더별 리포트 프롬프트 정의. env AI_PROMPT_VERSION_REPORT로 고른다(기본 v2). */
export const reportPrompts = {
  // TODO: 1.13.0 이전 앱 사용자가 업데이트한 뒤(v2 안정화 확인 후) v1 프롬프트 폴더와 전환 env를 제거한다
  v1: reportPromptV1,
  v2: reportPromptV2,
} as const;
