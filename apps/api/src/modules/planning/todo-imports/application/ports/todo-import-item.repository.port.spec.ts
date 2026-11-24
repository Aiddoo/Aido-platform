import { TodoImportId } from "#api/modules/planning/todo-imports/domain/todo-import-id.vo";
import { describeTodoImportItemRepositoryContract } from "#test/contracts/planning/todo-import-item-repository.contract";
import { InMemoryTodoImportItemRepository } from "#test/doubles/planning/in-memory-todo-import-item.repository";

// 같은 계약을 integration에서는 Drizzle 저장소로 돌려 테스트 대역이 실제와 같게 움직이는지 지킨다
describeTodoImportItemRepositoryContract(async () => ({
  items: new InMemoryTodoImportItemRepository(),
  importId: TodoImportId.generate(),
}));
