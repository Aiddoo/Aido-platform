import { Module } from "@nestjs/common";

import { FollowModule } from "../follow/follow.module.js";
import { NotificationModule } from "../notification/notification.module.js";
import { SchedulerModule } from "../scheduler/scheduler.module.js";
import { TodoCategoryModule } from "../todo-category/todo-category.module.js";
import { UserSettingsModule } from "../user-settings/user-settings.module.js";
import { CATEGORY_OWNERSHIP } from "./application/ports/category-ownership.port.js";
import { FRIEND_PORT } from "./application/ports/friend.port.js";
import { STREAK_PORT } from "./application/ports/streak.port.js";
import { TODO_CACHE, type TodoCachePort } from "./application/ports/todo-cache.port.js";
import { TODO_NOTIFICATION } from "./application/ports/todo-notification.port.js";
import {
  TODO_READ_REPOSITORY,
  type TodoReadRepositoryPort,
} from "./application/ports/todo-read.repository.port.js";
import { TODO_REMINDER } from "./application/ports/todo-reminder.port.js";
import { TODO_REPOSITORY } from "./application/ports/todo.repository.port.js";
import { TodoViewCacheInvalidator } from "./application/services/todo-view-cache.invalidator.js";
import { TODO_PROVIDERS } from "./application/todo.providers.js";
import { CreateRecurringTodosUseCase, CreateTodoUseCase } from "./application/use-cases/index.js";
import { CategoryOwnershipAdapter } from "./infrastructure/adapters/category-ownership.adapter.js";
import { FriendAdapter } from "./infrastructure/adapters/friend.adapter.js";
import { PrismaTodoReadRepository } from "./infrastructure/adapters/prisma-todo-read.repository.js";
import { PrismaTodoRepository } from "./infrastructure/adapters/prisma-todo.repository.js";
import { StreakAdapter } from "./infrastructure/adapters/streak.adapter.js";
import { TodoCacheAdapter } from "./infrastructure/adapters/todo-cache.adapter.js";
import { TodoNotificationAdapter } from "./infrastructure/adapters/todo-notification.adapter.js";
import { TodoReminderAdapter } from "./infrastructure/adapters/todo-reminder.adapter.js";
import { TodoRowRepository } from "./infrastructure/persistence/todo-row.repository.js";
import { TodoController } from "./presentation/todo.controller.js";

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
 * ### 아키텍처 (클린아키텍처 마이그레이션 완료)
 * - 모든 유스케이스가 단일 execute(input)를 가진 use-case + 도메인 애그리게잇으로 처리됨
 * - 쓰기(애그리게잇)/읽기(응답 read model) 리포지토리를 포트로 분리
 * - 크로스모듈 의존(카테고리·친구·스트릭·알림·캐시)은 포트/어댑터로 역전
 * - Controller는 endpoint UseCase를 직접 주입
 * - 외부 모듈에는 실제로 필요한 생성 UseCase만 명시적으로 공개
 */
@Module({
  imports: [
    FollowModule,
    NotificationModule,
    TodoCategoryModule,
    SchedulerModule,
    UserSettingsModule,
  ],
  controllers: [TodoController],
  providers: [
    TodoRowRepository,
    PrismaTodoRepository,
    PrismaTodoReadRepository,
    { provide: TODO_REPOSITORY, useExisting: PrismaTodoRepository },
    { provide: TODO_READ_REPOSITORY, useExisting: PrismaTodoReadRepository },
    { provide: CATEGORY_OWNERSHIP, useClass: CategoryOwnershipAdapter },
    { provide: TODO_CACHE, useClass: TodoCacheAdapter },
    { provide: FRIEND_PORT, useClass: FriendAdapter },
    { provide: STREAK_PORT, useClass: StreakAdapter },
    { provide: TODO_NOTIFICATION, useClass: TodoNotificationAdapter },
    { provide: TODO_REMINDER, useClass: TodoReminderAdapter },
    ...TODO_PROVIDERS,
    // 크로스 모듈 호환 경계 — 다른 모듈은 이 capability만 본다
    {
      provide: TodoViewCacheInvalidator,
      inject: [TODO_READ_REPOSITORY, TODO_CACHE],
      useFactory: (readRepository: TodoReadRepositoryPort, cache: TodoCachePort) =>
        new TodoViewCacheInvalidator(readRepository, cache),
    },
  ],
  exports: [CreateTodoUseCase, CreateRecurringTodosUseCase, TodoViewCacheInvalidator],
})
export class TodoModule {}
