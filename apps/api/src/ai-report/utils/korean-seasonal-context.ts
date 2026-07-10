/**
 * 한국 시즌 컨텍스트 생성
 *
 * 현재 날짜에 해당하는 한국 공휴일/시즌 이벤트를 프롬프트 섹션 문자열로 반환합니다.
 * 양력 기준으로 매핑하며, 음력 공휴일은 양력 근사치를 사용합니다.
 */

interface SeasonalEvent {
	readonly month: number;
	readonly startDay: number;
	readonly endDay: number;
	readonly label: string;
	readonly labelEn: string;
}

const SEASONAL_EVENTS: readonly SeasonalEvent[] = [
	{
		month: 1,
		startDay: 1,
		endDay: 3,
		label: "새해 연휴 기간",
		labelEn: "New Year holiday period",
	},
	{
		month: 2,
		startDay: 8,
		endDay: 12,
		label: "설 연휴 근처",
		labelEn: "around the Lunar New Year holiday",
	},
	{
		month: 3,
		startDay: 1,
		endDay: 31,
		label: "새 학기/분기 시작",
		labelEn: "start of a new semester/quarter",
	},
	{
		month: 4,
		startDay: 1,
		endDay: 15,
		label: "벚꽃 시즌",
		labelEn: "cherry blossom season",
	},
	{
		month: 5,
		startDay: 1,
		endDay: 5,
		label: "어린이날 연휴",
		labelEn: "Children's Day holiday",
	},
	{
		month: 6,
		startDay: 15,
		endDay: 30,
		label: "장마 시즌",
		labelEn: "rainy (monsoon) season",
	},
	{
		month: 7,
		startDay: 1,
		endDay: 31,
		label: "여름 휴가 시즌",
		labelEn: "summer vacation season",
	},
	{
		month: 8,
		startDay: 1,
		endDay: 31,
		label: "여름 휴가 시즌",
		labelEn: "summer vacation season",
	},
	{
		month: 9,
		startDay: 10,
		endDay: 20,
		label: "추석 연휴 근처",
		labelEn: "around the Chuseok holiday",
	},
	{
		month: 11,
		startDay: 1,
		endDay: 30,
		label: "수능 시즌",
		labelEn: "college entrance exam season",
	},
	{
		month: 12,
		startDay: 20,
		endDay: 31,
		label: "연말 마무리 시즌",
		labelEn: "end-of-year wrap-up season",
	},
] as const;

/**
 * 현재 날짜에 해당하는 한국 시즌 컨텍스트 반환
 *
 * @returns 시즌 프롬프트 섹션 문자열. 해당 시즌 없으면 빈 문자열.
 */
export function getKoreanSeasonalContext(
	date: Date,
	locale: "ko" | "en" = "ko",
): string {
	const month = date.getMonth() + 1;
	const day = date.getDate();

	const matched = SEASONAL_EVENTS.filter((event) => {
		return (
			event.month === month && day >= event.startDay && day <= event.endDay
		);
	});

	if (matched.length === 0) {
		return "";
	}

	if (locale === "en") {
		const labels = matched.map((e) => e.labelEn).join(", ");
		return [
			"## Seasonal context (Korea)",
			`Now: ${labels}`,
			"→ Weave this in naturally only when it connects to the data — never force it.",
		].join("\n");
	}

	const labels = matched.map((e) => e.label).join(", ");
	return [
		"## 시즌 참고",
		`현재: ${labels}`,
		"→ 이 시즌 맥락을 자연스럽게 반영해줘 (억지로 넣지 말고, 데이터와 연결될 때만).",
	].join("\n");
}
