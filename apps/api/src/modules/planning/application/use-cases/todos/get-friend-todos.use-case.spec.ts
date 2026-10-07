import type { Todo as TodoResponse } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";
import type { Mocked } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import type { CursorPaginatedResponse } from "#api/shared/application/pagination/index";
import { PaginationService } from "#api/shared/application/pagination/index";
import { TodoBuilder } from "#test/builders/index";
import {
  createFriendMock,
  createTodoCacheMock,
  createTodoReadRepositoryMock,
} from "#test/mocks/ports/index";

import { TodoMapper } from "../../../infrastructure/persistence/todos/todo-response.mapper.js";
import { type FriendPort } from "../../ports/todos/friend.port.js";
import { type TodoCachePort } from "../../ports/todos/todo-cache.port.js";
import { type TodoReadRepositoryPort } from "../../ports/todos/todo-read.repository.port.js";
import { GetFriendTodos } from "./get-friend-todos.use-case.js";

function buildResponse(id: number): TodoResponse {
  return TodoMapper.toResponse(TodoBuilder.create("friend-1").withId(id).build());
}

function buildPage(items: TodoResponse[]): CursorPaginatedResponse<TodoResponse, number> {
  return {
    items,
    pagination: { nextCursor: null, hasNext: false, size: 20 },
  };
}

describe("GetFriendTodos — 친구 PUBLIC Todo 조회 핸들러", () => {
  let useCase: GetFriendTodos;
  let todoReadRepository: Mocked<TodoReadRepositoryPort>;
  let friendPort: Mocked<FriendPort>;
  let todoCache: Mocked<TodoCachePort>;
  let paginationService: Mocked<PaginationService>;

  const baseInput = {
    userId: "user-123",
    friendUserId: "friend-1",
  };

  beforeEach(async () => {
    const getFriendTodosDependencies = mockDeep<ConstructorParameters<typeof GetFriendTodos>[0]>({
      todoReadRepository: createTodoReadRepositoryMock(),
      friendPort: createFriendMock(),
      todoCache: createTodoCacheMock(),
    });
    const unit = new GetFriendTodos(getFriendTodosDependencies);

    useCase = unit;
    todoReadRepository = getFriendTodosDependencies.todoReadRepository;
    friendPort = getFriendTodosDependencies.friendPort;
    todoCache = getFriendTodosDependencies.todoCache;
    paginationService = getFriendTodosDependencies.paginationService;

    friendPort.isMutualFriend.mockResolvedValue(true);
    paginationService.normalizeCursorPagination.mockImplementation((params) => {
      const size = params.size ?? 20;
      return { cursor: params.cursor, size, take: size + 1 };
    });
    paginationService.createCursorPaginatedResponse.mockImplementation((params) => {
      const { items, size } = params;
      const hasNext = items.length > size;
      const actualItems = hasNext ? items.slice(0, size) : items;
      return {
        items: actualItems,
        pagination: { nextCursor: null, hasNext, size },
      };
    });
  });

  it("첫 페이지 캐시 히트 시 저장소를 거치지 않고 캐시 값을 반환한다 (권한 확인은 수행)", async () => {
    // Given - 캐시에 첫 페이지 존재
    const cachedPage = buildPage([buildResponse(1)]);
    todoCache.readFriendTodosFirstPage.mockResolvedValue({
      generation: "generation-1",
      page: cachedPage,
    });

    // When
    const result = await useCase.execute({
      ...baseInput,
      startDate: new Date("2026-07-01"),
      endDate: new Date("2026-07-31"),
    });

    // Then - 맞팔 확인은 매 요청 수행, 저장소·set은 미호출
    expect(friendPort.isMutualFriend).toHaveBeenCalledWith("user-123", "friend-1");
    expect(todoCache.readFriendTodosFirstPage).toHaveBeenCalledWith(
      "friend-1",
      "2026-07-01",
      "2026-07-31",
      20,
    );
    expect(todoReadRepository.findPublicTodosByUserId).not.toHaveBeenCalled();
    expect(todoCache.storeFriendTodosFirstPageIfCurrent).not.toHaveBeenCalled();
    expect(result).toBe(cachedPage);
  });

  it("첫 페이지 캐시 미스 시 저장소를 조회하고 정규화된 키로 캐싱한다", async () => {
    // Given - 캐시 미스
    todoCache.readFriendTodosFirstPage.mockResolvedValue({
      generation: "generation-1",
      page: undefined,
    });
    const items = [buildResponse(1), buildResponse(2)];
    todoReadRepository.findPublicTodosByUserId.mockResolvedValue(items);

    // When
    const result = await useCase.execute({
      ...baseInput,
      startDate: new Date("2026-07-01"),
      endDate: new Date("2026-07-31"),
    });

    // Then - 조회 후 YYYY-MM-DD 정규화 키로 set
    expect(todoReadRepository.findPublicTodosByUserId).toHaveBeenCalledWith({
      friendUserId: "friend-1",
      cursor: undefined,
      size: 20,
      startDate: new Date("2026-07-01"),
      endDate: new Date("2026-07-31"),
    });
    expect(todoCache.storeFriendTodosFirstPageIfCurrent).toHaveBeenCalledWith(
      "friend-1",
      "2026-07-01",
      "2026-07-31",
      20,
      "generation-1",
      result,
    );
    expect(result.items).toHaveLength(2);
  });

  it("날짜 미지정 시 키 날짜 세그먼트는 '-'로 정규화된다", async () => {
    // Given
    todoCache.readFriendTodosFirstPage.mockResolvedValue({
      generation: "generation-1",
      page: undefined,
    });
    todoReadRepository.findPublicTodosByUserId.mockResolvedValue([]);

    // When
    await useCase.execute(baseInput);

    // Then
    expect(todoCache.readFriendTodosFirstPage).toHaveBeenCalledWith("friend-1", "-", "-", 20);
    expect(todoCache.storeFriendTodosFirstPageIfCurrent).toHaveBeenCalledWith(
      "friend-1",
      "-",
      "-",
      20,
      "generation-1",
      expect.objectContaining({ items: [] }),
    );
  });

  it("커서 페이지는 캐시를 조회하지도 저장하지도 않는다", async () => {
    // Given - cursor 지정 (2페이지 이후)
    todoReadRepository.findPublicTodosByUserId.mockResolvedValue([buildResponse(6)]);

    // When
    await useCase.execute({ ...baseInput, cursor: 5 });

    // Then
    expect(todoCache.readFriendTodosFirstPage).not.toHaveBeenCalled();
    expect(todoCache.storeFriendTodosFirstPageIfCurrent).not.toHaveBeenCalled();
    expect(todoReadRepository.findPublicTodosByUserId).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: 5 }),
    );
  });

  it("startDate > endDate이면 SYS_0002를 던지고 캐시·저장소에 접근하지 않는다", async () => {
    // When & Then
    await expect(
      useCase.execute({
        ...baseInput,
        startDate: new Date("2026-07-31"),
        endDate: new Date("2026-07-01"),
      }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.SYS_0002 });
    expect(friendPort.isMutualFriend).not.toHaveBeenCalled();
    expect(todoCache.readFriendTodosFirstPage).not.toHaveBeenCalled();
    expect(todoCache.storeFriendTodosFirstPageIfCurrent).not.toHaveBeenCalled();
    expect(todoReadRepository.findPublicTodosByUserId).not.toHaveBeenCalled();
  });

  it("맞팔이 아니면 FOLLOW_0906을 던지고 캐시·저장소에 접근하지 않는다", async () => {
    // Given
    friendPort.isMutualFriend.mockResolvedValue(false);

    // When & Then
    await expect(useCase.execute(baseInput)).rejects.toMatchObject({
      errorCode: ErrorCode.FOLLOW_0906,
    });
    expect(todoCache.readFriendTodosFirstPage).not.toHaveBeenCalled();
    expect(todoCache.storeFriendTodosFirstPageIfCurrent).not.toHaveBeenCalled();
    expect(todoReadRepository.findPublicTodosByUserId).not.toHaveBeenCalled();
  });
});
