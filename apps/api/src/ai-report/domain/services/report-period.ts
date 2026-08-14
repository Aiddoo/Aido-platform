import dayjs from "dayjs";

import { toDateString } from "@/shared/domain/date/utils/format";
import type { SupportedLocale } from "@/shared/domain/locale";

import type { ReportType } from "../types";

const MONTH_NAMES_EN = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
] as const;

/**
 * 기간 라벨 생성 — 리포트 생성 언어(locale)에 맞춰 표기한다.
 *
 * @example
 * computePeriodLabel("WEEKLY", 2026, 10)        → "2026년 10주차"
 * computePeriodLabel("MONTHLY", 2026, 3)        → "2026년 3월"
 * computePeriodLabel("WEEKLY", 2026, 10, "en")  → "Week 10, 2026"
 * computePeriodLabel("MONTHLY", 2026, 3, "en")  → "March 2026"
 */
export function computePeriodLabel(
	type: ReportType,
	year: number,
	period: number,
	locale: SupportedLocale = "ko",
): string {
	if (locale === "en") {
		if (type === "WEEKLY") {
			return `Week ${period}, ${year}`;
		}
		return `${MONTH_NAMES_EN[period - 1]} ${year}`;
	}
	if (type === "WEEKLY") {
		return `${year}년 ${period}주차`;
	}
	return `${year}년 ${period}월`;
}

/**
 * 날짜 범위 계산
 *
 * WEEKLY: ISO 주 기준 월요일 ~ 일요일
 * MONTHLY: 해당 월 1일 ~ 마지막 날
 */
export function computeDateRange(
	type: ReportType,
	year: number,
	period: number,
): { startDate: string; endDate: string } {
	if (type === "WEEKLY") {
		// ISO week: 해당 연도, 해당 주차의 월요일 ~ 일요일
		const monday = dayjs.utc().year(year).isoWeek(period).startOf("isoWeek");
		const sunday = monday.endOf("isoWeek");
		return {
			startDate: toDateString(monday.toDate()),
			endDate: toDateString(sunday.toDate()),
		};
	}

	// MONTHLY: 해당 월 1일 ~ 마지막 날
	const monthStart = dayjs
		.utc()
		.year(year)
		.month(period - 1)
		.startOf("month");
	const monthEnd = monthStart.endOf("month");
	return {
		startDate: toDateString(monthStart.toDate()),
		endDate: toDateString(monthEnd.toDate()),
	};
}
