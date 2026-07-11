import { Inject, Injectable, Logger } from "@nestjs/common";

import { assembleAggregatedData } from "../../domain/services/report-aggregation";
import type { AggregatedReportData, AggregateParams } from "../../domain/types";
import {
	TODO_STATS_READER,
	type TodoStatsReaderPort,
} from "../ports/todo-stats.reader.port";

/**
 * 리포트 데이터 집계 서비스
 *
 * 할 일 통계 읽기 포트로 원시 그룹 집계를 조회하고, 도메인 서비스로 통계를 계산한다.
 */
@Injectable()
export class ReportAggregatorService {
	readonly #logger = new Logger(ReportAggregatorService.name);

	constructor(
		@Inject(TODO_STATS_READER)
		private readonly todoStatsReader: TodoStatsReaderPort,
	) {}

	/**
	 * 리포트 데이터 집계
	 *
	 * 1. 현재/이전 기간 할 일 통계를 병렬로 조회(포트)
	 * 2. 도메인 서비스로 요일별/시간대별/카테고리별/연속일 패턴 계산
	 */
	async aggregate(params: AggregateParams): Promise<AggregatedReportData> {
		const { userId, startDate, endDate, timezone } = params;

		this.#logger.debug(
			`데이터 집계 시작: userId=${userId}, range=${startDate.toISOString()}~${endDate.toISOString()}`,
		);

		const inputs = await this.todoStatsReader.fetchAggregationInputs(params);

		return assembleAggregatedData(inputs, startDate, endDate, timezone);
	}
}
