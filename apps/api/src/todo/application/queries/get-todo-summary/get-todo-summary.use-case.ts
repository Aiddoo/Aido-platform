import { Inject, Injectable } from "@nestjs/common";

import { toDateString } from "@/shared/domain/date/utils/format";
import { computeEffectiveStreak } from "@/user-settings";

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

		const [stats, topTodos, streakContext] = await Promise.all([
			this.todoReadRepository.getTodayTodoStats(userId, today),
			// 미완료 우선 정렬 — 위젯에서 남은 일이 먼저 보이게 (정렬은 DB가 소유,
			// 클라이언트 절단 이후 정렬하면 한도 밖 미완료가 누락된다)
			this.todoReadRepository.findTodayTopTodos(userId, today, TOP_TODOS_LIMIT),
			this.streakPort.getStreakContext(userId),
		]);

		const { completionRate, isComplete } = summarizeCompletion(stats);
		// 스케줄러와 동일한 도메인 판정 — 전체 완료 직후 스트릭 쓰기(fire-and-forget)가
		// 아직 착지하지 않은 레이스에서도 위젯이 갱신된 스트릭(+1)을 보여준다
		const { streak: currentStreak } = computeEffectiveStreak({
			currentStreak: streakContext.currentStreak,
			lastCompletedDate: streakContext.lastCompletedDate,
			todosCompleted: stats.completed,
			todosTotal: stats.total,
			today,
		});

		return {
			date: toDateString(today),
			totalTodos: stats.total,
			completedTodos: stats.completed,
			completionRate,
			isComplete,
			currentStreak,
			topTodos,
		};
	}
}
