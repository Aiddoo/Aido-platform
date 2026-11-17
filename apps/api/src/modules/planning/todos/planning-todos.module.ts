import { Module } from "@nestjs/common";

import { AccessFeatureGrantsQueriesModule } from "#api/modules/access/feature-grants/access-feature-grants.public";
import { IdentitySettingsModule } from "#api/modules/identity/identity-settings.public";
import { NotificationQueueModule } from "#api/modules/notification/notifications/notification-notifications-jobs.public";
import { SocialFriendshipsModule } from "#api/modules/social/friendships/social-friendships.public";

import { PlanningTodoSeriesModule } from "../todo-series/planning-todo-series.module.js";
import { StagedTodoCreatorPort } from "./application/ports/staged-todo-creator.port.js";
import { TodoEngagementCounterPort } from "./application/ports/todo-engagement-counter.port.js";
import { TodoViewCacheInvalidatorPort } from "./application/ports/todo-view-cache-invalidator.port.js";
import { RemoveCategoryTodosUseCase } from "./application/use-cases/remove-category-todos.use-case.js";
import { PlanningTodoPortsModule } from "./planning-todo-ports.module.js";
import { PLANNING_TODOS_PROVIDERS } from "./planning-todos.providers.js";
import { TodoController } from "./presentation/http/v1/todo.controller.js";

@Module({
  imports: [
    PlanningTodoPortsModule,
    PlanningTodoSeriesModule,
    SocialFriendshipsModule,
    NotificationQueueModule,
    IdentitySettingsModule,
    AccessFeatureGrantsQueriesModule,
  ],
  controllers: [TodoController],
  providers: [...PLANNING_TODOS_PROVIDERS],
  exports: [
    PlanningTodoPortsModule,
    StagedTodoCreatorPort,
    TodoEngagementCounterPort,
    TodoViewCacheInvalidatorPort,
    RemoveCategoryTodosUseCase,
  ],
})
export class PlanningTodosModule {}
