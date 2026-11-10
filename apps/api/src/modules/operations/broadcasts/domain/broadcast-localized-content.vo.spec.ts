import { ErrorCode } from "@aido/api/errors";

import { BroadcastContent } from "./broadcast-content.vo.js";
import { BroadcastLocalizedContent } from "./broadcast-localized-content.vo.js";

describe("BroadcastLocalizedContent — 언어별 문구", () => {
  it("일부 언어만 담을 수 있고 문구는 앞뒤 공백을 다듬는다", () => {
    // When
    const localized = BroadcastLocalizedContent.create({
      en: { title: "  Hello  ", body: " World " },
    });

    // Then
    expect(localized.contentFor("en")).toEqual(
      BroadcastContent.create({ title: "Hello", body: "World" }),
    );
    expect(localized.contentFor("ko")).toBeNull();
    expect(localized.isEmpty).toBe(false);
  });

  it("없거나 비어 있으면 아무 언어도 담지 않는다", () => {
    expect(BroadcastLocalizedContent.create(undefined).isEmpty).toBe(true);
    expect(BroadcastLocalizedContent.create({}).isEmpty).toBe(true);
    expect(BroadcastLocalizedContent.create(null).isEmpty).toBe(true);
  });

  it("언어별 제목이나 본문이 비어 있으면 SYS_0002로 거부한다", () => {
    expect(() => BroadcastLocalizedContent.create({ en: { title: " ", body: "body" } })).toThrow(
      expect.objectContaining({ errorCode: ErrorCode.SYS_0002 }),
    );
  });
});
