import { GetMemoUseCase } from "./get-memo/get-memo.use-case";
import { GetMemoResourceLimitUseCase } from "./get-memo-resource-limit/get-memo-resource-limit.use-case";
import { GetMemosUseCase } from "./get-memos/get-memos.use-case";

export { GetMemoResourceLimitUseCase, GetMemosUseCase, GetMemoUseCase };

/** 메모 쿼리 use-case (모듈 등록용 배럴). */
export const MemoQueryUseCases = [
	GetMemoUseCase,
	GetMemosUseCase,
	GetMemoResourceLimitUseCase,
];
