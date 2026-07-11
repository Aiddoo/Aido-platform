import type { ReportStatus } from "@aido/validators";
import { Inject, Injectable } from "@nestjs/common";
import dayjs from "dayjs";
import { now } from "@/shared/domain/date/utils/core";

import {
	AI_REPORT_REPOSITORY,
	type AiReportRepositoryPort,
} from "../../ports/ai-report.repository.port";
import { ReportAccessService } from "../../services/report-access.service";

/** 리포트 생성 기준 타임존 (KST 고정) */
const KST = "Asia/Seoul";
/** 리포트 크론 실행 시각 (KST) */
const REPORT_HOUR = 8;

/**
 * 리포트 상태 조회 use-case.
 *
 * 다음 주간/월간 리포트 예정일과 최신 리포트를 반환한다.
 * 리포트 생성은 KST 08:00 고정이므로 KST 기준으로 계산한다.
 */
@Injectable()
export class GetReportStatusUseCase {
	constructor(
		@Inject(AI_REPORT_REPOSITORY)
		private readonly aiReportRepository: AiReportRepositoryPort,
		private readonly reportAccess: ReportAccessService,
	) {}

	async execute(userId: string, _timezone: string): Promise<ReportStatus> {
		await this.reportAccess.enforcePremium(userId);

		const kstNow = dayjs(now()).tz(KST);

		// 다음 주간 리포트: 이번 주 또는 다음 주 월요일 08:00 KST
		const thisMonday = kstNow.startOf("isoWeek").hour(REPORT_HOUR);
		const nextWeeklyKst = kstNow.isBefore(thisMonday)
			? thisMonday
			: thisMonday.add(1, "week");

		// 다음 월간 리포트: 이번 달 또는 다음 달 1일 08:00 KST
		const thisFirst = kstNow.startOf("month").hour(REPORT_HOUR);
		const nextMonthlyKst = kstNow.isBefore(thisFirst)
			? thisFirst
			: kstNow.add(1, "month").startOf("month").hour(REPORT_HOUR);

		const daysUntilWeekly = nextWeeklyKst
			.startOf("day")
			.diff(kstNow.startOf("day"), "day");
		const daysUntilMonthly = nextMonthlyKst
			.startOf("day")
			.diff(kstNow.startOf("day"), "day");

		const [latestWeekly, latestMonthly] = await Promise.all([
			this.aiReportRepository.findLatest(userId, "WEEKLY"),
			this.aiReportRepository.findLatest(userId, "MONTHLY"),
		]);

		return {
			nextWeeklyAt: nextWeeklyKst.utc().toISOString(),
			nextMonthlyAt: nextMonthlyKst.utc().toISOString(),
			daysUntilWeekly,
			daysUntilMonthly,
			latestWeekly: latestWeekly ? latestWeekly.toView() : null,
			latestMonthly: latestMonthly ? latestMonthly.toView() : null,
		};
	}
}
