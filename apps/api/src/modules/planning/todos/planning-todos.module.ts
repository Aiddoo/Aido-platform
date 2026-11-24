import { Module } from "@nestjs/common";

import { AccessFeatureGrantsQueriesModule } from "#api/modules/access/feature-grants/access-feature-grants.public";
import { IdentityUserPreferencesModule } from "#api/modules/identity/user-preferences/identity-user-preferences.public";
import { NotificationQueueModule } from "#api/modules/notification/notifications/notification-notifications-jobs.public";
import { SocialFriendshipsModule } from "#api/modules/social/friendships/social-friendships.public";

import { PlanningTodoSeriesModule } from "../todo-series/planning-todo-series.module.js";
import { StagedTodoBatchCreatorPort } from "./application/ports/staged-todo-batch-creator.port.js";
import { StagedTodoCreatorPort } from "./application/ports/staged-todo-creator.port.js";
import { TodoEngagementCounterPort } from "./application/ports/todo-engagement-counter.port.js";
import { TodoViewCacheInvalidatorPort } from "./application/ports/todo-view-cache-invalidator.port.js";
import { RemoveCategoryTodosUseCase } from "./application/use-cases/remove-category-todos.use-case.js";
import { RemoveTodosUseCase } from "./application/use-cases/remove-todos.use-case.js";
import { PlanningTodoPortsModule } from "./planning-todo-ports.module.js";
import { PLANNING_TODOS_PROVIDERS } from "./planning-todos.providers.js";
import { TodoFieldController } from "./presentation/http/v1/todo-field.controller.js";
import { TodoItemController } from "./presentation/http/v1/todo-item.controller.js";
import { TodoQueryController } from "./presentation/http/v1/todo-query.controller.js";
import { TodoController } from "./presentation/http/v1/todo.controller.js";

@Module({
  imports: [
    PlanningTodoPortsModule,
    PlanningTodoSeriesModule,
    SocialFriendshipsModule,
    NotificationQueueModule,
    IdentityUserPreferencesModule,
    AccessFeatureGrantsQueriesModule,
  ],
  // 고정 경로 GET(summary·overview·resource-limit)이 GET :id보다 먼저 등록되게 조회 Controller를 맨 앞에 둔다
  controllers: [TodoQueryController, TodoController, TodoFieldController, TodoItemController],
  providers: [...PLANNING_TODOS_PROVIDERS],
  exports: [
    PlanningTodoPortsModule,
    StagedTodoCreatorPort,
    StagedTodoBatchCreatorPort,
    TodoEngagementCounterPort,
    TodoViewCacheInvalidatorPort,
    RemoveCategoryTodosUseCase,
    RemoveTodosUseCase,
  ],
})
export class PlanningTodosModule {}
