import {
  daysUntil,
  formatJoined,
  formatKst,
  formatKstWithRelative,
} from "./discord-notice-format.mapper.js";

describe("Discord 알림 시각 표기", () => {
  it("UTC 시각을 KST 날짜와 분 단위 시각으로 적는다", () => {
    // Given
    const iso = "2026-12-10T00:00:00.000Z";

    // When
    const rendered = formatKst(iso);

    // Then
    expect(rendered).toBe("2026-12-10 09:00 KST");
  });

  it("UTC 날짜가 달라도 KST 달력 날짜로 적는다", () => {
    // Given
    const iso = "2026-12-10T15:30:45.999Z";

    // When
    const rendered = formatKst(iso);

    // Then
    expect(rendered).toBe("2026-12-11 00:30 KST");
  });

  it("읽을 수 없는 값은 원문 그대로 둔다", () => {
    // Given
    const iso = "not-a-date";

    // When
    const rendered = [formatKst(iso), formatKstWithRelative(iso)];

    // Then
    expect(rendered).toEqual(["not-a-date", "not-a-date"]);
  });

  it("KST 시각 뒤에 Discord 상대 시각을 초 단위로 붙인다", () => {
    // Given
    const iso = "2026-12-10T00:00:00.500Z";

    // When
    const rendered = formatKstWithRelative(iso);

    // Then
    expect(rendered).toBe("2026-12-10 09:00 KST · <t:1796860800:R>");
  });

  it("가입일은 KST 달력 날짜 차이로 센다", () => {
    // Given
    const joinedAt = "2026-10-01T14:59:00.000Z";
    const at = "2026-11-10T15:00:00.000Z";

    // When
    const rendered = formatJoined(joinedAt, at);

    // Then
    expect(rendered).toBe("2026-10-01 (D+41)");
  });

  it("같은 KST 날짜에 가입했으면 오늘 가입으로 적는다", () => {
    // Given
    const joinedAt = "2026-11-10T00:00:00.000Z";
    const at = "2026-11-10T14:00:00.000Z";

    // When
    const rendered = formatJoined(joinedAt, at);

    // Then
    expect(rendered).toBe("2026-11-10 (D+0, 오늘 가입)");
  });

  it("남은 날은 하루가 안 남았어도 1일로 세고 지났으면 0이다", () => {
    // Given
    const at = "2026-11-10T00:00:00.000Z";

    // When
    const remaining = [
      daysUntil("2026-11-10T01:00:00.000Z", at),
      daysUntil("2026-11-13T00:00:00.000Z", at),
      daysUntil("2026-11-01T00:00:00.000Z", at),
      daysUntil("garbage", at),
    ];

    // Then
    expect(remaining).toEqual([1, 3, 0, null]);
  });
});
