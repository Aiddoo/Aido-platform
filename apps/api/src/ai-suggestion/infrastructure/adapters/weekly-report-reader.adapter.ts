import { Inject, Injectable } from "@nestjs/common";

import {
	LATEST_REPORT_STATS_READER,
	type LatestReportStatsReaderPort,
} from "@/ai-report";

import type {
	WeeklyReportReaderPort,
	WeeklyReportView,
} from "../../application/ports/weekly-report-reader.port";

/**
 * WeeklyReportReaderPort의 어댑터.
 *
 * ai-report 모듈의 Facade로 위임하여 최신 WEEKLY 보고서 통계를 읽는다.
 */
@Injectable()
export class WeeklyReportReaderAdapter implements WeeklyReportReaderPort {
	constructor(
		@Inject(LATEST_REPORT_STATS_READER)
		private readonly latestReportStatsReader: LatestReportStatsReaderPort,
	) {}

	async findLatestWeekly(userId: string): Promise<WeeklyReportView | null> {
		const stats = await this.latestReportStatsReader.findLatestWeekly(userId);
		if (stats === null) {
			return null;
		}
		return { stats };
	}
}
