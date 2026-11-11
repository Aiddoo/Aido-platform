import { Module } from "@nestjs/common";

import { AccessEntitlementsModule } from "#api/modules/access/entitlements/access-entitlements.public";
import { IdentitySettingsModule } from "#api/modules/identity/identity-settings.public";
import { NotificationPushModule } from "#api/modules/notification/notification-delivery.public";
import { SocialFriendsModule } from "#api/modules/social/friends/social-friends.public";

import { PlanningTodoSeriesModule } from "../todo-series/planning-todo-series.module.js";
import { StagedTodoCreatorPort } from "./application/ports/staged-todo-creator.port.js";
import { TodoEngagementCounterPort } from "./application/ports/todo-engagement-counter.port.js";
import { TodoViewCacheInvalidatorPort } from "./application/ports/todo-view-cache-invalidator.port.js";
import { PlanningTodoPortsModule } from "./planning-todo-ports.module.js";
import { PLANNING_TODOS_PROVIDERS } from "./planning-todos.providers.js";
import { TodoController } from "./presentation/http/v1/todo.controller.js";

@Module({
  imports: [
    PlanningTodoPortsModule,
    PlanningTodoSeriesModule,
    SocialFriendsModule,
    NotificationPushModule,
    IdentitySettingsModule,
    AccessEntitlementsModule,
  ],
  controllers: [TodoController],
  providers: [...PLANNING_TODOS_PROVIDERS],
  exports: [
    PlanningTodoPortsModule,
    StagedTodoCreatorPort,
    TodoEngagementCounterPort,
    TodoViewCacheInvalidatorPort,
  ],
})
export class PlanningTodosModule {}
