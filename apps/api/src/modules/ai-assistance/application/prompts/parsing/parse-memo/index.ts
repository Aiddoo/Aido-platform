import { parseMemoPromptV1 } from "./v1/index.js";

export type * from "./types.js";

/** 버전 폴더별 parse-memo 프롬프트 정의 */
export const parseMemoPrompts = {
  v1: parseMemoPromptV1,
} as const;
