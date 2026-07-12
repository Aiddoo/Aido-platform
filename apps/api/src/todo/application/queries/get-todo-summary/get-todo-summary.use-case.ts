import { Inject, Injectable } from "@nestjs/common";
import { toDateString } from "@/shared/domain/date/utils/format";
import { summarizeCompletion } from "../../../domain/services/completion-policy";
import { STREAK_PORT, type StreakPort } from "../../ports/streak.port";
import {
	TODO_READ_REPOSITORY,
	type TodoReadRepositoryPort,
} from "../../ports/todo-read.repository.port";

/** 홈 위젯 요약에 노출되는 할 일 최대 개수 (large 위젯 리스트 기준) */
const TOP_TODOS_LIMIT = 10;

/** 오늘의 할 일 요약 조회 입력. today는 사용자 로컬 "오늘"의 UTC midnight. */
export interface GetTodoSummaryInput {
	userId: string;
	today: Date;
}

/** 요약에 포함되는 할 일 항목 — use-case가 계약(반환 타입)을 소유합니다 */
export interface TodoSummaryTodoResult {
	id: number;
	title: string;
	completed: boolean;
	categoryColor: string;
}

/** 오늘의 할 일 요약 조회 결과 — use-case가 계약(반환 타입)을 소유합니다 */
export interface TodoSummaryResult {
	date: string;
	totalTodos: number;
	completedTodos: number;
	completionRate: number;
	isComplete: boolean;
	currentStreak: number;
	topTodos: TodoSummaryTodoResult[];
}

/**
 * 오늘의 할 일 요약 조회 use-case (홈 위젯용)
 *
 * 오늘 진행률(총계/완료/완료율) + 현재 스트릭 + 상위 할 일 목록을
 * 한 번의 호출로 반환합니다. 완료율/완료일 규칙은 도메인 정책
 * (completion-policy.summarizeCompletion)이 소유합니다.
 */
@Injectable()
export class GetTodoSummaryUseCase {
	constructor(
		@Inject(TODO_READ_REPOSITORY)
		private readonly todoReadRepository: TodoReadRepositoryPort,
		@Inject(STREAK_PORT)
		private readonly streakPort: StreakPort,
	) {}

	async execute(input: GetTodoSummaryInput): Promise<TodoSummaryResult> {
		const { userId, today } = input;

		const [stats, todayTodos, currentStreak] = await Promise.all([
			this.todoReadRepository.getTodayTodoStats(userId, today),
			this.todoReadRepository.findManyByUserId({
				userId,
				size: TOP_TODOS_LIMIT,
				startDate: today,
				endDate: today,
			}),
			this.streakPort.getCurrentStreak(userId),
		]);

		const { completionRate, isComplete } = summarizeCompletion(stats);

		return {
			date: toDateString(today),
			totalTodos: stats.total,
			completedTodos: stats.completed,
			completionRate,
			isComplete,
			currentStreak,
			// findManyByUserId는 hasNext 판별용으로 size+1개를 반환하므로 상한으로 절단
			topTodos: todayTodos.slice(0, TOP_TODOS_LIMIT).map((todo) => ({
				id: todo.id,
				title: todo.title,
				completed: todo.completed,
				categoryColor: todo.category.color,
			})),
		};
	}
}
