import { Injectable } from "@nestjs/common";

import { AiReportFacade } from "@/ai-report";

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
	constructor(private readonly aiReportFacade: AiReportFacade) {}

	async findLatestWeekly(userId: string): Promise<WeeklyReportView | null> {
		const stats = await this.aiReportFacade.findLatestReportStats(
			userId,
			"WEEKLY",
		);
		if (stats === null) {
			return null;
		}
		return { stats };
	}
}
