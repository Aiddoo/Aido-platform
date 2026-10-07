import { PaginationService } from "#api/shared/application/pagination/index";
import type {
  AfterCommitTask,
  AfterCommitTaskRegistryPort,
  SavepointRunnerPort,
  MutationLockPort,
} from "#api/shared/application/ports/index";
import { MemoBuilder } from "#test/builders/memo.builder";
import { FakeLogger } from "#test/mocks/fake-logger.service";
import { StubMemoRepository } from "#test/mocks/ports/notes-memo.stub";
import { StubNotesTodoCreator } from "#test/mocks/ports/notes-todo-creator.stub";
import { createUnitOfWorkMock } from "#test/mocks/ports/unit-of-work.mock";

export const NOTES_TIME = new Date("2026-04-06T00:00:00.000Z");

export function createNotesMemoFixture(userId = "notes-user") {
  const repository = new StubMemoRepository();
  const mutationLock: MutationLockPort = {
    async acquire(_keys) {},
  };
  const unitOfWork = createUnitOfWorkMock();
  const paginationService = new PaginationService();
  const logger = new FakeLogger();
  const todoCreator = new StubNotesTodoCreator();
  const registeredTasks: AfterCommitTask[] = [];
  const afterCommit: AfterCommitTaskRegistryPort = {
    register(task) {
      registeredTasks.push(task);
    },
  };
  const savepointRunner: SavepointRunnerPort = {
    async run(work) {
      return work();
    },
  };
  const addMemo = (
    content = "테스트 메모",
    sortOrder = repository.records.size,
    ownerId = userId,
  ) => {
    const record = MemoBuilder.create(ownerId)
      .withContent(content)
      .withSortOrder(sortOrder)
      .build();
    repository.seed(record);
    return record;
  };
  return {
    userId,
    repository,
    mutationLock,
    unitOfWork,
    paginationService,
    logger,
    addMemo,
    todoCreator,
    registeredTasks,
    afterCommit,
    savepointRunner,
  };
}
