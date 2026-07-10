import { Query } from "@nestjs/cqrs";

/** 메모 리소스 제한 조회 결과. */
export interface MemoResourceLimit {
	currentCount: number;
	maxPerUser: number;
}

/** 메모 리소스 제한 정보 조회 쿼리. */
export class GetMemoResourceLimitQuery extends Query<MemoResourceLimit> {
	constructor(public readonly userId: string) {
		super();
	}
}
