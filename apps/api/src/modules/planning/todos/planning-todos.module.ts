import { Module } from "@nestjs/common";

import { AccessModule } from "../../access/access-entitlement.public.js";
import { IdentitySettingsModule } from "../../identity/identity-settings.public.js";
import { IdentityUserAccessModule } from "../../identity/identity-user-access.public.js";
import { NotificationDeliveryModule } from "../../notification/notification-delivery.public.js";
import { NotificationRemindersModule } from "../../notification/notification-reminders.public.js";
import { SocialFriendsModule } from "../../social/social-friends.public.js";
import { PlanningCategoriesModule } from "../planning-categories.module.js";
import { TODO_SERIES_OWNER } from "../todo-series/application/ports/todo-series-owner.port.js";
import { TODO_SERIES_REPOSITORY } from "../todo-series/application/ports/todo-series.repository.port.js";
import { TodoSeriesOwnerAdapter } from "../todo-series/infrastructure/adapters/todo-series-owner.adapter.js";
import { DrizzleTodoSeriesRepository } from "../todo-series/infrastructure/persistence/drizzle-todo-series.repository.js";
import { TodoSeriesController } from "../todo-series/presentation/http/v1/todo-series.controller.js";
import { CATEGORY_OWNERSHIP } from "./application/ports/category-ownership.port.js";
import { FRIEND_PORT } from "./application/ports/friend.port.js";
import {
  STAGED_TODO_CREATOR,
  StagedTodoCreatorPort,
} from "./application/ports/staged-todo-creator.port.js";
import { STREAK_PORT } from "./application/ports/streak.port.js";
import { TODO_CACHE, type TodoCachePort } from "./application/ports/todo-cache.port.js";
import { TODO_NOTIFICATION } from "./application/ports/todo-notification.port.js";
import { TODO_OWNER_TIMEZONE } from "./application/ports/todo-owner-timezone.port.js";
import { TODO_PLAN_READER } from "./application/ports/todo-plan.reader.port.js";
import {
  TODO_READ_REPOSITORY,
  type TodoReadRepositoryPort,
} from "./application/ports/todo-read.repository.port.js";
import { TODO_REMINDER } from "./application/ports/todo-reminder-scheduler.port.js";
import { TODO_VIEW_CACHE_INVALIDATOR } from "./application/ports/todo-view-cache-invalidator.port.js";
import { TODO_REPOSITORY } from "./application/ports/todo.repository.port.js";
import { InvalidateTodoViewCacheUseCase } from "./application/use-cases/invalidate-todo-view-cache.use-case.js";
import { StageTodoCreationUseCase } from "./application/use-cases/stage-todo-creation.use-case.js";
import { CategoryOwnershipAdapter } from "./infrastructure/adapters/category-ownership.adapter.js";
import { FriendAdapter } from "./infrastructure/adapters/friend.adapter.js";
import { StreakAdapter } from "./infrastructure/adapters/streak.adapter.js";
import { TodoCacheAdapter } from "./infrastructure/adapters/todo-cache.adapter.js";
import { TodoNotificationAdapter } from "./infrastructure/adapters/todo-notification.adapter.js";
import { TodoOwnerTimezoneAdapter } from "./infrastructure/adapters/todo-owner-timezone.adapter.js";
import { TodoReminderAdapter } from "./infrastructure/adapters/todo-reminder-scheduler.adapter.js";
import { DrizzleTodoReadRepository } from "./infrastructure/persistence/drizzle-todo-read.repository.js";
import { DrizzleTodoRepository } from "./infrastructure/persistence/drizzle-todo.repository.js";
import { TODO_PROVIDERS } from "./planning-todos.providers.js";
import { TodoController } from "./presentation/http/v1/todo.controller.js";

@Module({
  imports: [
    SocialFriendsModule,
    NotificationDeliveryModule,
    PlanningCategoriesModule,
    NotificationRemindersModule,
    IdentitySettingsModule,
    IdentityUserAccessModule,
    AccessModule,
  ],
  controllers: [TodoController, TodoSeriesController],
  providers: [
    DrizzleTodoRepository,
    DrizzleTodoReadRepository,
    { provide: TODO_REPOSITORY, useExisting: DrizzleTodoRepository },
    { provide: TODO_SERIES_REPOSITORY, useClass: DrizzleTodoSeriesRepository },
    { provide: TODO_SERIES_OWNER, useClass: TodoSeriesOwnerAdapter },
    { provide: TODO_READ_REPOSITORY, useExisting: DrizzleTodoReadRepository },
    { provide: TODO_PLAN_READER, useExisting: DrizzleTodoReadRepository },
    { provide: CATEGORY_OWNERSHIP, useClass: CategoryOwnershipAdapter },
    { provide: TODO_CACHE, useClass: TodoCacheAdapter },
    { provide: FRIEND_PORT, useClass: FriendAdapter },
    { provide: STREAK_PORT, useClass: StreakAdapter },
    { provide: TODO_NOTIFICATION, useClass: TodoNotificationAdapter },
    { provide: TODO_REMINDER, useClass: TodoReminderAdapter },
    { provide: TODO_OWNER_TIMEZONE, useClass: TodoOwnerTimezoneAdapter },
    ...TODO_PROVIDERS,
    { provide: STAGED_TODO_CREATOR, useExisting: StageTodoCreationUseCase },
    { provide: StagedTodoCreatorPort, useExisting: StageTodoCreationUseCase },
    {
      provide: InvalidateTodoViewCacheUseCase,
      inject: [TODO_READ_REPOSITORY, TODO_CACHE],
      useFactory: (readRepository: TodoReadRepositoryPort, cache: TodoCachePort) =>
        new InvalidateTodoViewCacheUseCase({ todoReadRepository: readRepository, cache }),
    },
    {
      provide: TODO_VIEW_CACHE_INVALIDATOR,
      useExisting: InvalidateTodoViewCacheUseCase,
    },
  ],
  exports: [
    STAGED_TODO_CREATOR,
    StagedTodoCreatorPort,
    TODO_PLAN_READER,
    TODO_VIEW_CACHE_INVALIDATOR,
  ],
})
export class PlanningTodosModule {}
