import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { EngagementTodoCommentLikesModule } from "#api/modules/engagement/todo-comment-likes/engagement-todo-comment-likes.public";
import { NotificationPushModule } from "#api/modules/notification/notification-delivery.public";
import { PlanningTodoQueriesModule } from "#api/modules/planning/todos/planning-todo-queries.public";
import { PlanningTodosModule } from "#api/modules/planning/todos/planning-todos.public";
import { SocialUserBlocksQueriesModule } from "#api/modules/social/user-blocks/social-user-blocks.public";

import { TodoCommentAccountCleanupPort } from "./application/ports/todo-comment-account-cleanup.port.js";
import { engagementTodoCommentsConfig } from "./engagement-todo-comments.config.js";
import { ENGAGEMENT_TODO_COMMENTS_PROVIDERS } from "./engagement-todo-comments.providers.js";
import { TodoCommentController } from "./presentation/http/v1/todo-comment.controller.js";
import { TodoCommentThreadController } from "./presentation/http/v2/todo-comment-thread.controller.js";

@Module({
  imports: [
    EngagementTodoCommentLikesModule,
    NotificationPushModule,
    PlanningTodosModule,
    PlanningTodoQueriesModule,
    SocialUserBlocksQueriesModule,
    ConfigModule.forFeature(engagementTodoCommentsConfig),
  ],
  controllers: [TodoCommentController, TodoCommentThreadController],
  providers: [...ENGAGEMENT_TODO_COMMENTS_PROVIDERS],
  exports: [TodoCommentAccountCleanupPort],
})
export class EngagementTodoCommentsModule {}
