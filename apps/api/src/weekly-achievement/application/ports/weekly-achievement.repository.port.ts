import type {
	WeeklyAchievementRow,
	WeeklyAchievementUpsert,
} from "../../domain/weekly-achievement";

/** WeeklyAchievementRepositoryPort DI 토큰 */
export const WEEKLY_ACHIEVEMENT_REPOSITORY = Symbol("WEEKLY_ACHIEVEMENT_REPOSITORY");

/**
 * 주간 달성 저장소 포트.
 *
 * 조회(연도별 커서 페이지네이션·연도 전체·단일 주차)와 일괄 upsert를 추상화한다.
 * 영속 방식(Prisma·트랜잭션)은 인프라 어댑터가 담당한다.
 */
export interface WeeklyAchievementRepositoryPort {
	/** 연도별 주간 달성 기록을 커서 기반 페이지네이션으로 조회 (week 내림차순) */
	findByYear(
		userId: string,
		year: number,
		cursor: number | undefined,
		take: number,
	): Promise<WeeklyAchievementRow[]>;

	/** 특정 연도의 모든 주간 달성 기록 (week 오름차순, summary 계산용) */
	findAllByYear(userId: string, year: number): Promise<WeeklyAchievementRow[]>;

	/** 특정 연도/주차의 달성 기록 (없으면 null) */
	findByYearAndWeek(
		userId: string,
		year: number,
		week: number,
	): Promise<WeeklyAchievementRow | null>;

	/** 여러 주간 달성 기록을 트랜잭션으로 일괄 upsert */
	upsertMany(snapshots: WeeklyAchievementUpsert[]): Promise<void>;
}
