import { Module } from "@nestjs/common";

import { EngagementTodoCommentLikesModule } from "./todo-comment-likes/engagement-todo-comment-likes.module.js";
import { EngagementTodoCommentsModule } from "./todo-comments/engagement-todo-comments.module.js";

@Module({
  imports: [EngagementTodoCommentsModule, EngagementTodoCommentLikesModule],
  exports: [EngagementTodoCommentsModule, EngagementTodoCommentLikesModule],
})
export class EngagementModule {}
