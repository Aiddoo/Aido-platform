/**
 * TodoCategoryLimitReaderPort — 트랜잭션 내 카테고리 보유 한도 조회 포트.
 *
 * 카테고리 생성의 entitlement/count/create 원자성을 위해 활성 트랜잭션
 * 연결에서 캐시를 거치지 않고 현재 보유 한도를 읽는다.
 */
export const TODO_CATEGORY_LIMIT_READER = Symbol("TODO_CATEGORY_LIMIT_READER");

export interface TodoCategoryLimitReaderPort {
	/** 트랜잭션 내 사용자 카테고리 최대 보유량 (null이면 무제한) */
	getMaxCountInTx(userId: string): Promise<number | null>;
}
