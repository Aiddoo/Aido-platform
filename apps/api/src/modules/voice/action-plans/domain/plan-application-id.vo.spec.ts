import { PlanApplicationId } from "./plan-application-id.vo.js";

// 같은 테이블의 DB 기본값(createEntityId)과 옮기기 전 직접 만든 값이 c + 소문자 hex 24자였다
describe("PlanApplicationId", () => {
  it("앱이 만드는 id는 c + 소문자 hex 24자(25자)다", () => {
    // When
    const ids = Array.from({ length: 20 }, () => PlanApplicationId.generate().value);

    // Then
    expect(ids.every((id) => /^c[0-9a-f]{24}$/.test(id))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
