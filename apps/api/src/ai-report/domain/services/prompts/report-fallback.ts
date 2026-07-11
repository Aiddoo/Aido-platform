import type { SupportedLocale } from "@/shared/presentation/decorators";

import type { GeneratedReportContent } from "../../types";

/**
 * AI 불가용 시 폴백 콘텐츠
 *
 * AI Provider가 불가용하거나 생성에 실패했을 때 사용하는 격려성 기본 콘텐츠.
 */
export function buildFallbackContent(
	hasActivity: boolean,
	locale: SupportedLocale = "ko",
): GeneratedReportContent {
	if (locale === "en") {
		if (!hasActivity) {
			return {
				aiSummary:
					"No to-dos were registered this period. Next time, try starting with one small goal!",
				aiTips: ["Try building the habit of adding just 1 to-do a day."],
			};
		}
		return {
			aiSummary:
				"This report was generated from your to-do stats for the period. Check the data above for details.",
			aiTips: [
				"Keep up your current pace and check in on your progress regularly.",
			],
		};
	}

	if (!hasActivity) {
		return {
			aiSummary:
				"이번 기간에는 등록된 할 일이 없었어요. 다음에는 작은 목표부터 시작해보세요!",
			aiTips: ["하루에 할 일 1개씩 등록하는 습관을 만들어보세요."],
		};
	}

	return {
		aiSummary:
			"이번 기간의 할 일 통계를 기반으로 리포트가 생성되었습니다. 자세한 통계는 위의 데이터를 확인해주세요.",
		aiTips: [
			"매일 같은 시간에 할 일을 정리하는 루틴을 만들어보세요.",
			"큰 할 일은 작은 단위로 나누면 달성률이 올라요.",
		],
	};
}
