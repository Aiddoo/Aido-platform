import type { InquiryCategory } from "@aido/validators";

/**
 * 문의 제출 도메인 값 — 벤더 중립 전달 페이로드.
 *
 * 이메일이든 슬랙이든 어떤 채널로 전달되든 무관하게 문의 한 건을 표현한다.
 * (전달 채널은 application 포트 InquiryMailerPort가 추상화)
 */
export interface InquirySubmission {
	readonly userEmail: string;
	readonly category: InquiryCategory;
	readonly categoryLabel: string;
	readonly content: string;
	readonly submittedAt: string;
}

const CATEGORY_LABELS: Record<InquiryCategory, string> = {
	BUG_REPORT: "버그 신고",
	FEATURE_REQUEST: "기능 요청",
	OTHER: "기타",
};

/** 문의 유형의 사람이 읽는 라벨 */
export function categoryLabel(category: InquiryCategory): string {
	return CATEGORY_LABELS[category];
}

/** 제출 시각을 KST 표기 문자열로 포맷 (예: "2026-07-11 14:30 (KST)") */
export function formatSubmittedAtKst(date: Date): string {
	const parts = new Intl.DateTimeFormat("ko-KR", {
		timeZone: "Asia/Seoul",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	}).formatToParts(date);

	const getValue = (type: Intl.DateTimeFormatPartTypes) =>
		parts.find((part) => part.type === type)?.value ?? "";

	return `${getValue("year")}-${getValue("month")}-${getValue("day")} ${getValue("hour")}:${getValue("minute")} (KST)`;
}

/**
 * 원시 입력 + 제출 시각으로부터 벤더 중립 문의 제출 값을 조립한다.
 * (순수 함수 — 현재 시각은 호출자가 주입: 도메인은 시계에 의존하지 않는다)
 */
export function buildInquirySubmission(
	input: {
		userEmail: string;
		category: InquiryCategory;
		content: string;
	},
	submittedAt: Date,
): InquirySubmission {
	return {
		userEmail: input.userEmail,
		category: input.category,
		categoryLabel: categoryLabel(input.category),
		content: input.content,
		submittedAt: formatSubmittedAtKst(submittedAt),
	};
}
