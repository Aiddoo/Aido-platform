import type { AggregateParams, AggregationInputs } from "../../domain/types";

export const TODO_STATS_READER = Symbol("TODO_STATS_READER");

/**
 * 할 일 통계 읽기 포트.
 *
 * 리포트 집계에 필요한 할 일/카테고리 원시 그룹 집계를 조회한다(N+1 방지 병렬 조회).
 * 계산은 도메인 서비스가 담당하고, 이 포트는 순수 데이터 조회만 소유한다.
 */
export interface TodoStatsReaderPort {
	fetchAggregationInputs(params: AggregateParams): Promise<AggregationInputs>;
}
