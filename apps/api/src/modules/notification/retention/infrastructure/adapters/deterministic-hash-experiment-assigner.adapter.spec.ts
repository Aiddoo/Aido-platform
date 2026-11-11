import { randomBytes, randomUUID } from "node:crypto";

import {
  RETENTION_EXPERIMENT_KEY,
  type RetentionVariant,
} from "../../domain/retention.constants.js";
import { DeterministicHashExperimentAssignerAdapter } from "./deterministic-hash-experiment-assigner.adapter.js";

// 1.15.0까지 domain/experiment-assignment.domain-service.ts에 있던 배정 함수 그대로다(비교 기준으로만 둔다)
function legacyAssignRetentionVariant(userId: string, treatmentPercent: number): RetentionVariant {
  let hash = 2_166_136_261;
  for (const character of userId) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16_777_619);
  }
  const bucket = (hash >>> 0) % 100;
  return bucket < treatmentPercent ? "TREATMENT" : "CONTROL";
}

const assigner = new DeterministicHashExperimentAssignerAdapter();

function assignRetention(userId: string, treatmentPercent: number) {
  return assigner.assign({
    experimentKey: RETENTION_EXPERIMENT_KEY,
    subjectId: userId,
    variants: [
      { key: "TREATMENT", weight: treatmentPercent },
      { key: "CONTROL", weight: 100 - treatmentPercent },
    ],
  });
}

function subjectIds(): string[] {
  return [
    ...Array.from({ length: 2000 }, () => `c${randomBytes(12).toString("hex")}`),
    ...Array.from({ length: 500 }, () => randomUUID()),
    "user-stable",
    "user-a",
    "",
    "사용자-가",
    "👩‍💻-emoji",
    "kakao_1234567890",
  ];
}

describe("DeterministicHashExperimentAssignerAdapter — 결정적 실험 배정", () => {
  it("리텐션 실험은 1.15.0 배정 함수와 모든 사용자·비율에서 같은 실험군을 고른다", () => {
    // Given
    const ids = subjectIds();
    const percents = [0, 1, 10, 25, 33, 50, 67, 90, 99, 100];

    // When
    const mismatches = ids.flatMap((id) =>
      percents
        .filter(
          (percent) => assignRetention(id, percent) !== legacyAssignRetentionVariant(id, percent),
        )
        .map((percent) => ({ id, percent })),
    );

    // Then
    expect(mismatches).toEqual([]);
  });

  it("기록해 둔 사용자의 구간 경계에서 실험군이 바뀌지 않는다", () => {
    // Given / When / Then: "user-stable"은 30번, "clz7x5p8k0031qz0z8z8z8z8z"는 10번 구간이다
    expect(assignRetention("user-stable", 30)).toBe("CONTROL");
    expect(assignRetention("user-stable", 31)).toBe("TREATMENT");
    expect(assignRetention("clz7x5p8k0031qz0z8z8z8z8z", 10)).toBe("CONTROL");
    expect(assignRetention("clz7x5p8k0031qz0z8z8z8z8z", 11)).toBe("TREATMENT");
  });

  it("같은 대상은 항상 같은 실험군이고 비율 0과 100의 경계를 지킨다", () => {
    expect(assignRetention("user-stable", 50)).toBe(assignRetention("user-stable", 50));
    expect(assignRetention("user-a", 0)).toBe("CONTROL");
    expect(assignRetention("user-a", 100)).toBe("TREATMENT");
  });

  it("새 실험은 실험 key를 섞어 같은 사용자도 실험마다 다른 구간에 놓인다", () => {
    // Given
    const ids = Array.from({ length: 1000 }, (_, index) => `user-${index}`);
    const variants = [
      { key: "A", weight: 50 },
      { key: "B", weight: 50 },
    ] as const;

    // When
    const sameAcrossExperiments = ids.filter(
      (subjectId) =>
        assigner.assign({ experimentKey: "copy_test_1", subjectId, variants }) ===
        assigner.assign({ experimentKey: "copy_test_2", subjectId, variants }),
    ).length;

    // Then: 독립이면 절반 근처다
    expect(sameAcrossExperiments).toBeGreaterThan(400);
    expect(sameAcrossExperiments).toBeLessThan(600);
  });

  it("비중이 있는 실험군이 없으면 배정하지 않는다", () => {
    expect(() =>
      assigner.assign({ experimentKey: "empty", subjectId: "user-a", variants: [] }),
    ).toThrow();
  });
});
