import { describe, expect, it } from "vitest";

import {
  PLAN_CATALOG,
  PLAN_FEATURE_KEYS,
  PREMIUM_FEATURE_KEYS,
  PREMIUM_FEATURES,
} from "../src/vocabulary/index.js";

describe("PLAN_CATALOG — 플랜 카탈로그", () => {
  it("출시 앱이 읽는 기능은 무료·프리미엄 표시 값의 모양을 그대로 유지한다", () => {
    // When
    const { AI_PARSE, CHEER, NUDGE, FRIEND, TODO_CATEGORY } = PREMIUM_FEATURES;

    // Then
    expect(AI_PARSE).toMatchObject({
      kind: "quota",
      period: "month",
      free: 10,
      premium: null,
    });
    expect(CHEER).toEqual({
      kind: "quota",
      period: "day",
      free: 3,
      premium: null,
    });
    expect(NUDGE).toEqual({
      kind: "quota",
      period: "day",
      free: 3,
      premium: null,
    });
    expect(FRIEND).toEqual({ kind: "resource", free: 5, premium: null });
    expect(TODO_CATEGORY).toEqual({ kind: "resource", free: 3, premium: 30 });
  });

  it("무제한으로 보이는 프리미엄 AI 정리·녹음 정리에도 공정 사용 상한이 있다", () => {
    // When
    const { AI_PARSE, VOICE_NOTE } = PLAN_CATALOG;

    // Then
    expect(AI_PARSE.fairUse.premium).toBe(1000);
    expect(VOICE_NOTE).toMatchObject({
      free: 3,
      premium: null,
      fairUse: { premium: 100 },
      perUse: { maxSeconds: { free: 180, premium: 1800 } },
    });
  });

  it("전체 키는 출시 키 순서 뒤에 새 기능을 붙이고 카탈로그와 같은 순서다", () => {
    // When
    const releasedKeys = PLAN_FEATURE_KEYS.slice(0, PREMIUM_FEATURE_KEYS.length);
    const catalogKeys = Object.keys(PLAN_CATALOG);
    const premiumFeatureKeys = Object.keys(PREMIUM_FEATURES);

    // Then
    expect(releasedKeys).toEqual([...PREMIUM_FEATURE_KEYS]);
    expect(catalogKeys).toEqual([...PLAN_FEATURE_KEYS]);
    expect(premiumFeatureKeys).toEqual([...PREMIUM_FEATURE_KEYS]);
  });

  it("앱만 막는 기능은 앱 아이콘 하나이고 서버가 판단하는 flag는 무료에서 꺼져 있다", () => {
    // When
    const clientOnly = PLAN_FEATURE_KEYS.filter((key) => {
      const feature = PLAN_CATALOG[key];
      return feature.kind === "flag" && "clientOnly" in feature;
    });

    // Then
    expect(clientOnly).toEqual(["APP_ICON"]);
    expect(PREMIUM_FEATURES.AI_REPORT).toEqual({ kind: "flag", free: false, premium: true });
  });
});
