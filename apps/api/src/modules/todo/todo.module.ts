import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";

import { FollowModule } from "../follow/follow.module";
import { NotificationModule } from "../notification/notification.module";
import { SchedulerModule } from "../scheduler/scheduler.module";
import { TodoCategoryModule } from "../todo-category/todo-category.module";
import { UserSettingsModule } from "../user-settings/user-settings.module";

import { EventHandlers } from "./application/events";
import { TODO_REPOSITORY } from "./application/ports/todo.repository.port";
import { QueryHandlers } from "./application/queries/handlers";
import { CommandHandlers } from "./application/use-cases";
import { PrismaTodoRepository } from "./infrastructure/adapters/prisma-todo.repository";
import { TodoController } from "./todo.controller";
import { TodoRepository } from "./todo.repository";
import { TodoService } from "./todo.service";

/**
 * Todo 모듈
 *
 * 할 일 관리 기능을 담당합니다.
 * - CRUD 작업 (생성, 조회, 수정, 삭제)
 * - 카테고리별 분류 및 필터링
 * - 순서 변경 (드래그 앤 드롭)
 * - 커서 기반 페이지네이션
 * - 날짜별 조회
 * - 친구의 PUBLIC 투두 조회
 * - 리마인더 즉시 스케줄링 (생성/수정/삭제 시 타이머 관리)
 * - 완료 시 스트릭 갱신
 *
 * ### 아키텍처 (클린아키텍처 마이그레이션 진행 중)
 * - 생성/완료 토글/조회는 CQRS 유스케이스(커맨드·쿼리 핸들러) + 도메인 애그리게잇으로 처리
 * - 나머지 액션은 TodoService에 유지(동일 패턴으로 순차 이관 예정)
 */
@Module({
	imports: [
		CqrsModule,
		FollowModule,
		NotificationModule,
		TodoCategoryModule,
		SchedulerModule,
		UserSettingsModule,
	],
	controllers: [TodoController],
	providers: [
		TodoRepository,
		TodoService,
		PrismaTodoRepository,
		{ provide: TODO_REPOSITORY, useExisting: PrismaTodoRepository },
		...CommandHandlers,
		...QueryHandlers,
		...EventHandlers,
	],
	exports: [TodoService],
})
export class TodoModule {}
