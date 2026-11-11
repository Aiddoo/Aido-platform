import { TodoCategoryLockKeys } from "../../categories/application/categories.lock-keys.js";
import { TodoLockKeys } from "./todos.lock-keys.js";

// 배포 중 옛 버전·voice·ai와 같은 잠금을 잡아야 해서 옮긴 문자열을 바이트 단위로 고정한다
describe("planning 잠금 키", () => {
  it("할 일·정렬·카테고리 잠금 키는 옮기기 전 문자열과 같다", () => {
    // When
    const keys = [
      TodoLockKeys.todo(42),
      TodoLockKeys.sortOrder("user-a"),
      TodoCategoryLockKeys.userCategories("user-a"),
    ];

    // Then
    expect(keys).toEqual([
      "mutation:v1:todo:42",
      "mutation:v1:todo-sort-order:user-a",
      "mutation:v1:todo-category:user-a",
    ]);
  });
});
