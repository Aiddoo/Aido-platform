import { describeTodoCommentPurgeRepositoryContract } from "#test/contracts/engagement/todo-comment-purge-repository.contract";
import { InMemoryTodoCommentLikeRepository } from "#test/doubles/engagement/in-memory-todo-comment-like.repository";
import { InMemoryTodoCommentPurgeRepository } from "#test/doubles/engagement/in-memory-todo-comment-purge.repository";
import { InMemoryTodoCommentRepository } from "#test/doubles/engagement/in-memory-todo-comment.repository";

describeTodoCommentPurgeRepositoryContract(async () => {
  const comments = new InMemoryTodoCommentRepository();
  const likes = new InMemoryTodoCommentLikeRepository();
  return { comments, likes, purge: new InMemoryTodoCommentPurgeRepository(comments, likes) };
});
