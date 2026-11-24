import { TODO_LIMITS } from "@aido/api/vocabulary";

import { planTargetCapacity } from "./todo-import-capacity.domain-service.js";

const LIMIT = TODO_LIMITS.MAX_PER_CATEGORY;

describe("planTargetCapacity", () => {
  it("캘린더 여러 개가 한 대상을 가리키면 일정 수를 더해 한도와 비교한다", () => {
    // Given
    const targets = [{ targetKey: "all", categoryId: 7 }];
    const collections = [
      { targetKey: "all", expectedItemCount: 150 },
      { targetKey: "all", expectedItemCount: 100 },
    ];

    // When
    const shortages = planTargetCapacity({
      targets,
      collections,
      usageByCategory: new Map([[7, 51]]),
      limitPerCategory: LIMIT,
    });

    // Then
    expect(shortages).toEqual([{ targetKey: "all", current: 51, expected: 250, limit: LIMIT }]);
  });

  it("한도에 딱 맞으면 받고, 새 카테고리는 비어 있다고 본다", () => {
    // Given
    const targets = [
      { targetKey: "existing", categoryId: 7 },
      { targetKey: "new", categoryId: null },
    ];
    const collections = [
      { targetKey: "existing", expectedItemCount: 250 },
      { targetKey: "new", expectedItemCount: LIMIT },
    ];

    // When
    const shortages = planTargetCapacity({
      targets,
      collections,
      usageByCategory: new Map([[7, 50]]),
      limitPerCategory: LIMIT,
    });

    // Then
    expect(shortages).toEqual([]);
  });
});
