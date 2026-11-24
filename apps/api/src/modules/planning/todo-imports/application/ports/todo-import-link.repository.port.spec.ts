import { TodoImportId } from "#api/modules/planning/todo-imports/domain/todo-import-id.vo";
import { describeTodoImportLinkRepositoryContract } from "#test/contracts/planning/todo-import-link-repository.contract";
import { InMemoryTodoImportLinkRepository } from "#test/doubles/planning/in-memory-todo-import-link.repository";

// 같은 계약을 integration에서는 Drizzle 저장소로 돌려 테스트 대역이 실제와 같게 움직이는지 지킨다
describeTodoImportLinkRepositoryContract(async () => ({
  links: new InMemoryTodoImportLinkRepository(),
  importId: TodoImportId.generate(),
  todoIds: [11, 12, 13, 14],
}));
