import { GetMemoHandler } from "./get-memo.handler";
import { GetMemoResourceLimitHandler } from "./get-memo-resource-limit.handler";
import { GetMemosHandler } from "./get-memos.handler";

/** 메모 쿼리 핸들러 (모듈 등록용 배럴). */
export const QueryHandlers = [
	GetMemoHandler,
	GetMemosHandler,
	GetMemoResourceLimitHandler,
];
