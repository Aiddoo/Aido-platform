import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { NotificationDeliveryModule } from "#api/modules/notification/notification-delivery.public";
import { PlanningTodoQueriesModule } from "#api/modules/planning/todos/planning-todo-queries.public";
import { PlanningTodosModule } from "#api/modules/planning/todos/planning-todos.public";
import { SocialBlocksModule } from "#api/modules/social/blocks/social-blocks.public";

import { TodoCommentAccountCleanupPort } from "./application/ports/todo-comment-account-cleanup.port.js";
import { engagementCommentsConfig } from "./engagement-comments.config.js";
import { ENGAGEMENT_COMMENTS_PROVIDERS } from "./engagement-comments.providers.js";
import { TodoCommentController } from "./presentation/http/v1/todo-comment.controller.js";
import { TodoCommentV2Controller } from "./presentation/http/v2/todo-comment.controller.js";

@Module({
  imports: [
    NotificationDeliveryModule,
    PlanningTodosModule,
    PlanningTodoQueriesModule,
    SocialBlocksModule,
    ConfigModule.forFeature(engagementCommentsConfig),
  ],
  controllers: [TodoCommentController, TodoCommentV2Controller],
  providers: [...ENGAGEMENT_COMMENTS_PROVIDERS],
  exports: [TodoCommentAccountCleanupPort],
})
export class EngagementCommentsModule {}
