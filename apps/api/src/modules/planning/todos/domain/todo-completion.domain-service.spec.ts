/**
 * 완료 정책(completion-policy) 단위 테스트
 *
 * GWT 패턴 — 마일스톤 정확 일치 매핑·오늘 전체 완료 판정 검증
 */

import { isAllCompletedToday, milestoneForCount } from "./todo-completion.domain-service.js";

describe("completion-policy — 완료 정책", () => {
  describe("milestoneForCount", () => {
    it("누적 1개면 FIRST_COMPLETE를 반환한다", () => {
      // When
      const milestone = milestoneForCount(1);

      // Then
      expect(milestone).toBe("FIRST_COMPLETE");
    });

    it("누적 10개면 COUNT_10을 반환한다", () => {
      // When
      const milestone = milestoneForCount(10);

      // Then
      expect(milestone).toBe("COUNT_10");
    });

    it("누적 50개면 COUNT_50을 반환한다", () => {
      // When
      const milestone = milestoneForCount(50);

      // Then
      expect(milestone).toBe("COUNT_50");
    });

    it("누적 100개면 COUNT_100을 반환한다", () => {
      // When
      const milestone = milestoneForCount(100);

      // Then
      expect(milestone).toBe("COUNT_100");
    });

    it("마일스톤이 아닌 카운트는 null을 반환한다 (정확 일치 — 지나친 카운트 재발화 없음)", () => {
      // Given
      const nonMilestones = [0, 2, 9, 11, 49, 51, 99, 101, 1000];

      // When
      const milestones = nonMilestones.map((count) => milestoneForCount(count));

      // Then
      for (const milestone of milestones) {
        expect(milestone).toBeNull();
      }
    });
  });

  describe("isAllCompletedToday", () => {
    it("할 일이 하나도 없는 날은 완료로 치지 않는다", () => {
      // When
      const isAllCompleted = isAllCompletedToday({ total: 0, completed: 0 });

      // Then
      expect(isAllCompleted).toBe(false);
    });

    it("일부만 완료하면 false를 반환한다", () => {
      // When
      const isAllCompleted = isAllCompletedToday({ total: 3, completed: 2 });

      // Then
      expect(isAllCompleted).toBe(false);
    });

    it("전부 완료하면 true를 반환한다", () => {
      // When
      const isAllCompleted = isAllCompletedToday({ total: 3, completed: 3 });

      // Then
      expect(isAllCompleted).toBe(true);
    });
  });
});
