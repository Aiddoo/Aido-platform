import { describeTodoImportRepositoryContract } from "#test/contracts/planning/todo-import-repository.contract";
import { InMemoryTodoImportRepository } from "#test/doubles/planning/in-memory-todo-import.repository";

// 같은 계약을 integration에서는 Drizzle 저장소로 돌려 테스트 대역이 실제와 같게 움직이는지 지킨다
describeTodoImportRepositoryContract(async () => new InMemoryTodoImportRepository());
