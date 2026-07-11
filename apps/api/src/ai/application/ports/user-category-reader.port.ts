/**
 * 사용자 카테고리 리더 포트
 *
 * 프롬프트 조립 시 사용자의 카테고리 목록(id·name)이 필요하다. todo-category
 * 모듈 내부에 직접 의존하지 않도록 포트로 역전하고, 어댑터가 위임한다.
 */

/** 프롬프트용 최소 카테고리 정보. */
export interface UserCategory {
	id: number;
	name: string;
}

export interface UserCategoryReaderPort {
	/** 사용자의 카테고리 목록을 조회한다. */
	findByUserId(userId: string): Promise<UserCategory[]>;
}

/** 사용자 카테고리 리더 주입 토큰. */
export const USER_CATEGORY_READER = Symbol("USER_CATEGORY_READER");
