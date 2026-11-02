import { describe, expect, it } from "vitest";

import { PREMIUM_FEATURE_KEYS, PREMIUM_FEATURES } from "../src/vocabulary/index.js";

describe("PREMIUM_FEATURES — 유료 기능 카탈로그", () => {
  it("한도 기능의 무료·프리미엄 값이 배포된 앱이 쓰는 값과 같다", () => {
    // Then
    expect(PREMIUM_FEATURES.AI_PARSE).toEqual({
      kind: "quota",
      period: "month",
      free: 5,
      premium: null,
    });
    expect(PREMIUM_FEATURES.CHEER).toEqual({
      kind: "quota",
      period: "day",
      free: 3,
      premium: null,
    });
    expect(PREMIUM_FEATURES.NUDGE).toEqual({
      kind: "quota",
      period: "day",
      free: 3,
      premium: null,
    });
    expect(PREMIUM_FEATURES.FRIEND).toEqual({ kind: "resource", free: 5, premium: null });
    expect(PREMIUM_FEATURES.TODO_CATEGORY).toEqual({ kind: "resource", free: 3, premium: 30 });
  });

  it("키 목록과 카탈로그가 같은 기능을 같은 순서로 담는다", () => {
    // Then
    expect(Object.keys(PREMIUM_FEATURES)).toEqual([...PREMIUM_FEATURE_KEYS]);
  });

  it("앱만 막는 기능은 앱 아이콘 하나이고 서버가 판단하는 flag는 무료에서 꺼져 있다", () => {
    // When
    const clientOnly = PREMIUM_FEATURE_KEYS.filter((key) => {
      const feature = PREMIUM_FEATURES[key];
      return feature.kind === "flag" && "clientOnly" in feature;
    });

    // Then
    expect(clientOnly).toEqual(["APP_ICON"]);
    expect(PREMIUM_FEATURES.AI_REPORT).toEqual({ kind: "flag", free: false, premium: true });
  });
});
