import { subtractDays } from "@/shared/domain/date/utils/arithmetic";
import { toDateString } from "@/shared/domain/date/utils/format";
import { midnightInTimezone, startOfDayInTimezone } from "@/shared/domain/date/utils/timezone";

const KST = "Asia/Seoul";

/** 전일(KST) 가입 집계 기간 */
export interface SignupReportPeriod {
	/** 집계 시작(포함) UTC */
	startUtc: Date;
	/** 집계 종료(제외) UTC */
	endUtc: Date;
	/** 리포트 기준일 문자열 (YYYY-MM-DD, KST) */
	reportDateStr: string;
}

/**
 * 기준 시각(now) 기준 전일(KST 00:00 ~ 당일 KST 00:00) 집계 기간을 계산한다.
 */
export function computePreviousKstDayRange(now: Date): SignupReportPeriod {
	const kstTodayMidnight = midnightInTimezone(now, KST);
	const kstYesterdayMidnight = subtractDays(1, kstTodayMidnight);
	const kstYesterdayDate = startOfDayInTimezone(kstYesterdayMidnight, KST);

	return {
		startUtc: kstYesterdayMidnight,
		endUtc: kstTodayMidnight,
		reportDateStr: toDateString(kstYesterdayDate),
	};
}
