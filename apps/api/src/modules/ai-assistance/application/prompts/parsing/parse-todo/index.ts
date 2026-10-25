import { parseTodoPromptV1 } from "./v1/index.js";

export type * from "./types.js";

/** 버전 폴더별 parse-todo 프롬프트 정의 */
export const parseTodoPrompts = {
  v1: parseTodoPromptV1,
} as const;
