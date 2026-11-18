import type { Provider } from "@nestjs/common";

import { TodoCommentLikeReaderPort } from "./application/ports/todo-comment-like.reader.port.js";
import { TodoCommentLikeRepositoryPort } from "./application/ports/todo-comment-like.repository.port.js";
import { DrizzleTodoCommentLikeReader } from "./infrastructure/persistence/drizzle-todo-comment-like.reader.js";
import { DrizzleTodoCommentLikeRepository } from "./infrastructure/persistence/drizzle-todo-comment-like.repository.js";

export const ENGAGEMENT_TODO_COMMENT_LIKES_PROVIDERS = [
  { provide: TodoCommentLikeRepositoryPort, useClass: DrizzleTodoCommentLikeRepository },
  { provide: TodoCommentLikeReaderPort, useClass: DrizzleTodoCommentLikeReader },
] satisfies Provider[];
