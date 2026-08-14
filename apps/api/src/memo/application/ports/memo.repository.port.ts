import type { Memo } from "../../domain/entities/memo.aggregate";

/** 메모 목록 조회 파라미터 (정규화된 커서/사이즈). */
export interface FindMemosParams {
	userId: string;
	cursor?: number;
	size: number;
}

/**
 * 메모 저장소 포트.
 *
 * 도메인 애그리게잇(Memo) 단위로 읽고 쓴다. 트랜잭션 경계는 어댑터가
 * CLS(TransactionHost)에서 읽는다.
 */
export interface MemoRepositoryPort {
	create(userId: string, content: string, sortOrder: number): Promise<Memo>;
	findByIdAndUserId(memoId: number, userId: string): Promise<Memo | null>;
	findManyByUserId(params: FindMemosParams): Promise<Memo[]>;
	countByUserId(userId: string): Promise<number>;
	updateContent(memoId: number, content: string): Promise<Memo>;
	updatePinned(memoId: number, isPinned: boolean): Promise<Memo>;
	updateSortOrder(memoId: number, sortOrder: number): Promise<Memo>;
	getMaxSortOrder(userId: string): Promise<number>;
	shiftSortOrders(
		userId: string,
		fromSortOrder: number,
		toSortOrder: number | null,
		delta: number,
	): Promise<void>;
	delete(memoId: number): Promise<void>;
}

/** 메모 저장소 주입 토큰. */
export const MEMO_REPOSITORY = Symbol("MEMO_REPOSITORY");
