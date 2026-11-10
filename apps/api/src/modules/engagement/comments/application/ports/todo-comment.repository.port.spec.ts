import { describeTodoCommentRepositoryContract } from "#test/contracts/engagement/todo-comment-repository.contract";
import { InMemoryTodoCommentRepository } from "#test/doubles/engagement/in-memory-todo-comment.repository";

// 같은 계약을 integration에서는 Drizzle 저장소로 돌려 테스트 대역이 실제와 같게 움직이는지 지킨다
describeTodoCommentRepositoryContract(async () => new InMemoryTodoCommentRepository());
