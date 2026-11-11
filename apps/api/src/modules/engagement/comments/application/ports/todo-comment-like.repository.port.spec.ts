import { describeTodoCommentLikeRepositoryContract } from "#test/contracts/engagement/todo-comment-like-repository.contract";
import { InMemoryTodoCommentLikeRepository } from "#test/doubles/engagement/in-memory-todo-comment-like.repository";

describeTodoCommentLikeRepositoryContract(async () => new InMemoryTodoCommentLikeRepository());
