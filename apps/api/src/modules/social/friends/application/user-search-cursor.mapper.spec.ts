import { ErrorCode } from "@aido/api/errors";

import { decodeUserSearchCursor, encodeUserSearchCursor } from "./user-search-cursor.mapper.js";

describe("사용자 검색 커서", () => {
  it.each([
    { rank: 2, id: "clz7x5p8k0005qz0z8z8z8z8z" },
    { rank: 0, id: "clz7x5p8k0001qz0z8z8z8z8z" },
  ])("총수 없는 rank $rank 커서는 출시 앱이 받던 base64url 그대로 만들고 되돌린다", (position) => {
    // When
    const encoded = encodeUserSearchCursor({ position, totalCount: null });

    // Then
    expect(encoded).toBe(Buffer.from(`${position.rank}:${position.id}`).toString("base64url"));
    expect(decodeUserSearchCursor(encoded)).toEqual({ position, totalCount: null });
  });

  it("첫 쪽에서 센 총수는 커서 끝에 실어 되돌린다", () => {
    // Given
    const cursor = { position: { rank: 3, id: "clz7x5p8k0005qz0z8z8z8z8z" }, totalCount: 42 };

    // When
    const encoded = encodeUserSearchCursor(cursor);

    // Then
    expect(Buffer.from(encoded, "base64url").toString("utf8")).toBe(
      "3:clz7x5p8k0005qz0z8z8z8z8z:42",
    );
    expect(decodeUserSearchCursor(encoded)).toEqual(cursor);
  });

  it.each([
    { name: "구분자 없음", raw: Buffer.from("justtext").toString("base64url") },
    { name: "rank 없음", raw: Buffer.from(":clz7x5p8k0001").toString("base64url") },
    { name: "음수 rank", raw: Buffer.from("-1:clz7x5p8k0001").toString("base64url") },
    { name: "id 없음", raw: Buffer.from("2:").toString("base64url") },
    { name: "빈 총수", raw: Buffer.from("2:clz7x5p8k0001:").toString("base64url") },
    { name: "음수 총수", raw: Buffer.from("2:clz7x5p8k0001:-1").toString("base64url") },
    { name: "남는 칸", raw: Buffer.from("2:clz7x5p8k0001:3:4").toString("base64url") },
  ])("$name 커서는 FOLLOW_0912로 거절한다", ({ raw }) => {
    // When
    const decoding = () => decodeUserSearchCursor(raw);

    // Then
    expect(decoding).toThrow(
      expect.objectContaining({ errorCode: ErrorCode.FOLLOW_0912, details: { cursor: raw } }),
    );
  });
});
