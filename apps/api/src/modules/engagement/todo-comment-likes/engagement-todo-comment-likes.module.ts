import { Module } from "@nestjs/common";

import { TodoCommentLikeReaderPort } from "./application/ports/todo-comment-like.reader.port.js";
import { TodoCommentLikeRepositoryPort } from "./application/ports/todo-comment-like.repository.port.js";
import { ENGAGEMENT_TODO_COMMENT_LIKES_PROVIDERS } from "./engagement-todo-comment-likes.providers.js";

// 글의 likeCount와 같은 댓글 잠금 안에서 바뀌어 좋아요 UseCase·HTTP는 todo-comments slice가 가진다
@Module({
  providers: [...ENGAGEMENT_TODO_COMMENT_LIKES_PROVIDERS],
  exports: [TodoCommentLikeRepositoryPort, TodoCommentLikeReaderPort],
})
export class EngagementTodoCommentLikesModule {}
