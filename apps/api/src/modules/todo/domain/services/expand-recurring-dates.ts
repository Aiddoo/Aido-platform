import { DAY_OF_WEEK_MAP, type DayOfWeek } from "@aido/validators";
import dayjs from "dayjs";

/**
 * 반복 날짜 확장 도메인 서비스 (순수 함수)
 *
 * 날짜 범위(둘 다 포함)와 요일 목록으로 매칭되는 날짜(YYYY-MM-DD) 배열을 생성합니다.
 * 애그리게잇에 속하지 않는 순수 도메인 규칙이므로 도메인 서비스로 분리했습니다.
 */
export function expandRecurringDates(
	startDate: string,
	endDate: string,
	daysOfWeek: DayOfWeek[],
): string[] {
	const targetDays = new Set(daysOfWeek.map((d) => DAY_OF_WEEK_MAP[d]));
	const dates: string[] = [];
	let current = dayjs.utc(startDate);
	const end = dayjs.utc(endDate);

	while (current.isBefore(end) || current.isSame(end, "day")) {
		if (targetDays.has(current.day())) {
			dates.push(current.format("YYYY-MM-DD"));
		}
		current = current.add(1, "day");
	}

	return dates;
}
