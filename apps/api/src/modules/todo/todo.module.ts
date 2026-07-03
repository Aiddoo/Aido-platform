import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";

import { FollowModule } from "../follow/follow.module";
import { NotificationModule } from "../notification/notification.module";
import { SchedulerModule } from "../scheduler/scheduler.module";
import { TodoCategoryModule } from "../todo-category/todo-category.module";
import { UserSettingsModule } from "../user-settings/user-settings.module";

import { EventHandlers } from "./application/events";
import { CATEGORY_OWNERSHIP } from "./application/ports/category-ownership.port";
import { FRIEND_PORT } from "./application/ports/friend.port";
import { STREAK_PORT } from "./application/ports/streak.port";
import { TODO_REPOSITORY } from "./application/ports/todo.repository.port";
import { TODO_CACHE } from "./application/ports/todo-cache.port";
import { TODO_NOTIFICATION } from "./application/ports/todo-notification.port";
import { TODO_READ_REPOSITORY } from "./application/ports/todo-read.repository.port";
import { QueryHandlers } from "./application/queries/handlers";
import { CommandHandlers } from "./application/use-cases";
import { CategoryOwnershipAdapter } from "./infrastructure/adapters/category-ownership.adapter";
import { FriendAdapter } from "./infrastructure/adapters/friend.adapter";
import { PrismaTodoRepository } from "./infrastructure/adapters/prisma-todo.repository";
import { PrismaTodoReadRepository } from "./infrastructure/adapters/prisma-todo-read.repository";
import { StreakAdapter } from "./infrastructure/adapters/streak.adapter";
import { TodoCacheAdapter } from "./infrastructure/adapters/todo-cache.adapter";
import { TodoNotificationAdapter } from "./infrastructure/adapters/todo-notification.adapter";
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
 * - 단건 CRUD·완료 토글·부분/액션별 수정·카테고리 변경·순서 변경·조회는
 *   CQRS 유스케이스(커맨드·쿼리 핸들러) + 도메인 애그리게잇으로 처리
 * - 쓰기(애그리게잇)/읽기(응답 read model) 리포지토리를 포트로 분리
 * - 크로스모듈 의존(카테고리·친구·스트릭·알림·캐시)은 포트/어댑터로 역전
 * - 남은 액션(하위 항목·반복 생성)은 TodoService에 유지(동일 패턴으로 순차 이관 예정)
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
		PrismaTodoReadRepository,
		{ provide: TODO_REPOSITORY, useExisting: PrismaTodoRepository },
		{ provide: TODO_READ_REPOSITORY, useExisting: PrismaTodoReadRepository },
		{ provide: CATEGORY_OWNERSHIP, useClass: CategoryOwnershipAdapter },
		{ provide: TODO_CACHE, useClass: TodoCacheAdapter },
		{ provide: FRIEND_PORT, useClass: FriendAdapter },
		{ provide: STREAK_PORT, useClass: StreakAdapter },
		{ provide: TODO_NOTIFICATION, useClass: TodoNotificationAdapter },
		...CommandHandlers,
		...QueryHandlers,
		...EventHandlers,
	],
	exports: [TodoService],
})
export class TodoModule {}
