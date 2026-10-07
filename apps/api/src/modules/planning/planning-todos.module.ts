import { Module } from "@nestjs/common";

import { UserSettingsModule } from "../identity/identity-settings.module.js";
import { NotificationModule } from "../notification/notification-delivery.module.js";
import { SchedulerModule } from "../notification/notification-reminders.module.js";
import { SocialFriendsModule } from "../social/social-friends.public.js";
import { CATEGORY_OWNERSHIP } from "./application/ports/todos/category-ownership.port.js";
import { FRIEND_PORT } from "./application/ports/todos/friend.port.js";
import { STAGED_TODO_CREATOR } from "./application/ports/todos/staged-todo-creator.port.js";
import { STREAK_PORT } from "./application/ports/todos/streak.port.js";
import { TODO_CACHE, type TodoCachePort } from "./application/ports/todos/todo-cache.port.js";
import { TODO_CREATOR, type TodoCreatorPort } from "./application/ports/todos/todo-creator.port.js";
import { TODO_NOTIFICATION } from "./application/ports/todos/todo-notification.port.js";
import {
  TODO_READ_REPOSITORY,
  type TodoReadRepositoryPort,
} from "./application/ports/todos/todo-read.repository.port.js";
import { TODO_REMINDER } from "./application/ports/todos/todo-reminder.port.js";
import { TODO_VIEW_CACHE_INVALIDATOR } from "./application/ports/todos/todo-view-cache-invalidator.port.js";
import { TODO_REPOSITORY } from "./application/ports/todos/todo.repository.port.js";
import { StagedTodoCreator } from "./application/services/todos/staged-todo-creator.service.js";
import { TodoViewCacheInvalidator } from "./application/services/todos/todo-view-cache.invalidator.js";
import { CreateRecurringTodos } from "./application/use-cases/todos/create-recurring-todos.use-case.js";
import { CreateTodo } from "./application/use-cases/todos/create-todo.use-case.js";
import { CategoryOwnershipAdapter } from "./infrastructure/adapters/todos/category-ownership.adapter.js";
import { FriendAdapter } from "./infrastructure/adapters/todos/friend.adapter.js";
import { StreakAdapter } from "./infrastructure/adapters/todos/streak.adapter.js";
import { TodoCacheAdapter } from "./infrastructure/adapters/todos/todo-cache.adapter.js";
import { TodoNotificationAdapter } from "./infrastructure/adapters/todos/todo-notification.adapter.js";
import { TodoReminderAdapter } from "./infrastructure/adapters/todos/todo-reminder.adapter.js";
import { PrismaTodoReadRepository } from "./infrastructure/persistence/todos/prisma-todo-read.repository.js";
import { PrismaTodoRepository } from "./infrastructure/persistence/todos/prisma-todo.repository.js";
import { PlanningCategoriesModule } from "./planning-categories.module.js";
import { TODO_PROVIDERS } from "./planning-todos.providers.js";
import { TodoController } from "./presentation/controllers/todos/todo.controller.js";

@Module({
  imports: [
    SocialFriendsModule,
    NotificationModule,
    PlanningCategoriesModule,
    SchedulerModule,
    UserSettingsModule,
  ],
  controllers: [TodoController],
  providers: [
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
    { provide: STAGED_TODO_CREATOR, useExisting: StagedTodoCreator },
    {
      provide: TODO_CREATOR,
      inject: [CreateTodo, CreateRecurringTodos],
      useFactory: (
        createTodo: CreateTodo,
        createRecurringTodos: CreateRecurringTodos,
      ): TodoCreatorPort => ({
        createTodo: (input) => createTodo.execute(input),
        createRecurringTodos: (data, timezone) => createRecurringTodos.execute({ data, timezone }),
      }),
    },
    {
      provide: TodoViewCacheInvalidator,
      inject: [TODO_READ_REPOSITORY, TODO_CACHE],
      useFactory: (readRepository: TodoReadRepositoryPort, cache: TodoCachePort) =>
        new TodoViewCacheInvalidator({ todoReadRepository: readRepository, cache }),
    },
    {
      provide: TODO_VIEW_CACHE_INVALIDATOR,
      useExisting: TodoViewCacheInvalidator,
    },
  ],
  exports: [TODO_CREATOR, STAGED_TODO_CREATOR, TODO_VIEW_CACHE_INVALIDATOR],
})
export class PlanningTodosModule {}
