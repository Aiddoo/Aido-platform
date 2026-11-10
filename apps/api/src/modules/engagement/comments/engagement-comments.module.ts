import { Module } from "@nestjs/common";

import { NotificationDeliveryModule } from "#api/modules/notification/notification-delivery.public";
import { PlanningTodosModule } from "#api/modules/planning/todos/planning-todos.public";
import { SocialBlocksModule } from "#api/modules/social/social-blocks.public";

import {
  TODO_COMMENT_ACCOUNT_CLEANUP,
  TodoCommentAccountCleanupPort,
} from "./application/ports/todo-comment-account-cleanup.port.js";
import { ENGAGEMENT_COMMENTS_PROVIDERS } from "./engagement-comments.providers.js";
import { TodoCommentController } from "./presentation/http/v1/todo-comment.controller.js";
import { TodoCommentV2Controller } from "./presentation/http/v2/todo-comment.controller.js";

@Module({
  imports: [NotificationDeliveryModule, PlanningTodosModule, SocialBlocksModule],
  controllers: [TodoCommentController, TodoCommentV2Controller],
  providers: [...ENGAGEMENT_COMMENTS_PROVIDERS],
  exports: [TodoCommentAccountCleanupPort, TODO_COMMENT_ACCOUNT_CLEANUP],
})
export class EngagementCommentsModule {}
