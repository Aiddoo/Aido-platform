import { DatabaseRecordNotFoundError } from "#api/platform/database/prisma-error.util";
import {
  createMockTransactionHost,
  databaseWriteExpectation,
  nativeSqlParameters,
} from "#test/mocks/database.mock";
import { createMockDatabaseContext } from "#test/mocks/index";

import { PrismaTodoRepository } from "./prisma-todo.repository.js";

describe("PrismaTodoRepository 쓰기 계약", () => {
  it("부분 수정의 undefined는 생략하고 null과 false는 저장한다", async () => {
    // Given
    const db = createMockDatabaseContext();
    db.orm.public.Todo.updateAndCount.mockResolvedValue(1);
    const repository = new PrismaTodoRepository(createMockTransactionHost(db));
    // When
    await repository.updateDetails(1, { title: undefined, endDate: null, completed: false });
    // Then
    expect(db.orm.public.Todo.updateAndCount).toHaveBeenCalledWith(
      databaseWriteExpectation("Todo", { endDate: null, completed: false }),
    );
  });

  it("재정렬은 한 UPDATE로 요청 순서를 쓰고 사라진 item이 있으면 not-found 오류를 반환한다", async () => {
    // Given
    const db = createMockDatabaseContext();
    db.execute.mockResolvedValue({ affectedRows: 2 });
    const repository = new PrismaTodoRepository(createMockTransactionHost(db));
    // When
    const result = repository.reorderItems([3, 2, 1]);
    // Then
    await expect(result).rejects.toBeInstanceOf(DatabaseRecordNotFoundError);
    expect(db.execute).toHaveBeenCalledOnce();
    expect(nativeSqlParameters(db.execute.mock.calls[0]?.[0]).slice(1)).toEqual([3, 0, 2, 1, 1, 2]);
  });
});
