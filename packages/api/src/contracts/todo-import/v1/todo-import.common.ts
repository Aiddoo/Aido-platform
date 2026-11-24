import { z } from "zod";

import { TODO_IMPORT_LIMITS } from "../../../vocabulary/todo-import.constants.js";

/** 기기가 캘린더 id·일정 id를 sha256 hex로 바꾼 값. 원래 id(이메일일 수 있다)는 서버로 보내지 않는다 */
export const todoImportHashedKeySchema = z
  .hash("sha256")
  .meta({ description: "기기가 만든 sha256 hex 키 (64자)" });

export const todoImportTargetKeySchema = z
  .string()
  .min(1)
  .max(TODO_IMPORT_LIMITS.TARGET_KEY_MAX_LENGTH)
  .meta({ description: "요청 안에서 대상 카테고리를 가리키는 값 (앱이 정한다)" });
