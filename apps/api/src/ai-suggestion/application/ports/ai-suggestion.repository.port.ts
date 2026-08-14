import type { DayOfWeek } from "@aido/validators";

import type {
	Suggestion,
	SuggestionStatus,
} from "../../domain/entities/suggestion.aggregate";
import type {
	CategoryCompletionRate,
	DayCompletionRate,
	SuggestionHistoryItem,
	TimeCompletionRate,
	TodoSummaryForAnalysis,
	UserStreakInfo,
} from "../../domain/types";

export const AI_SUGGESTION_REPOSITORY = Symbol("AI_SUGGESTION_REPOSITORY");

/** 제안 일괄 생성 입력 — daysOfWeek/matchedTodos의 Json 직렬화는 어댑터 경계가 담당한다 */
export interface CreateSuggestionInput {
	userId: string;
	title: string;
	daysOfWeek: DayOfWeek[];
	scheduledTime: string | null;
	confidence: number;
	reason: string;
	matchedTodos: string[];
	expiresAt: Date;
	suggestedCategoryId: number | null;
}

/**
 * AI 반복 제안 저장소 포트.
 *
 * RecurringSuggestion 애그리게잇의 쓰기·단건 조회는 Suggestion 도메인 엔티티를,
 * 분석용 통계 읽기는 도메인 읽기 프로젝션을 반환한다. 트랜잭션은 CLS로 전파된다.
 */
export interface AiSuggestionRepositoryPort {
	findPendingByUserId(userId: string): Promise<Suggestion[]>;
	findByIdAndUserId(id: number, userId: string): Promise<Suggestion | null>;
	updateStatus(id: number, status: SuggestionStatus): Promise<Suggestion>;
	createMany(data: CreateSuggestionInput[]): Promise<{ count: number }>;
	deletePending(userId: string): Promise<{ count: number }>;
	deleteExpired(userId: string): Promise<{ count: number }>;

	// ── 분석용 통계 읽기 프로젝션 ──────────────────────────────
	findDayCompletionRates(
		userId: string,
		from: Date,
		to: Date,
		timezone: string,
	): Promise<DayCompletionRate[]>;
	findTimeCompletionRates(
		userId: string,
		from: Date,
		to: Date,
		timezone: string,
	): Promise<TimeCompletionRate>;
	findCategoryCompletionRates(
		userId: string,
		from: Date,
		to: Date,
	): Promise<CategoryCompletionRate[]>;
	findUserStreakInfo(userId: string): Promise<UserStreakInfo | null>;
	findRecentTodos(
		userId: string,
		from: Date,
		to: Date,
		timezone: string,
	): Promise<TodoSummaryForAnalysis[]>;
	findRecentResponded(
		userId: string,
		since: Date,
	): Promise<SuggestionHistoryItem[]>;
}
