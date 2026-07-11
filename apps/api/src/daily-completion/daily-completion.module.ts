import { Module } from "@nestjs/common";
import { DailyCompletionFacade } from "./application/facades/daily-completion.facade";
import { TODO_COMPLETION_REPOSITORY } from "./application/ports/todo-completion.repository.port";
import { DailyCompletionQueryUseCases } from "./application/queries";
import { PrismaTodoCompletionRepository } from "./infrastructure/adapters/prisma-todo-completion.repository";
import { DailyCompletionController } from "./presentation/daily-completion.controller";

/**
 * DailyCompletion 모듈 (클린아키텍처, 읽기 전용)
 *
 * 날짜별 완료 현황(캘린더 물고기 아이콘)을 조회한다. 집계는 포트로 추상화되며
 * 현재 어댑터는 Prisma groupBy로 DB 레벨 집계를 수행한다.
 */
@Module({
	controllers: [DailyCompletionController],
	providers: [
		DailyCompletionFacade,
		{
			provide: TODO_COMPLETION_REPOSITORY,
			useClass: PrismaTodoCompletionRepository,
		},
		...DailyCompletionQueryUseCases,
	],
})
export class DailyCompletionModule {}
