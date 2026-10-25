import { reportPromptV1 } from "./v1/index.js";

export type * from "./types.js";

/** 버전 폴더별 리포트 프롬프트 정의 */
export const reportPrompts = {
  v1: reportPromptV1,
} as const;
