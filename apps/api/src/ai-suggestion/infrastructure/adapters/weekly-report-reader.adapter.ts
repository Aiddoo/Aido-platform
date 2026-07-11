import { Injectable } from "@nestjs/common";

import { AiReportRepository } from "../../../ai-report/ai-report.repository";
import type {
	WeeklyReportReaderPort,
	WeeklyReportView,
} from "../../application/ports/weekly-report-reader.port";

/**
 * WeeklyReportReaderPort의 어댑터.
 *
 * 미이관 ai-report 모듈의 저장소로 위임하여 최신 WEEKLY 보고서를 읽는다.
 * ai-report 클린아키 전환 시 이 어댑터 내부만 교체하면 된다.
 */
@Injectable()
export class WeeklyReportReaderAdapter implements WeeklyReportReaderPort {
	constructor(private readonly aiReportRepository: AiReportRepository) {}

	async findLatestWeekly(userId: string): Promise<WeeklyReportView | null> {
		const report = await this.aiReportRepository.findLatest(userId, "WEEKLY");
		if (!report) {
			return null;
		}
		return { stats: report.stats };
	}
}
