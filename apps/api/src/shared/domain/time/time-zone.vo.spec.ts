import { ErrorCode } from "@aido/api/errors";

import { TimeZone } from "./time-zone.vo.js";

describe("TimeZone — 시간대", () => {
  it.each(["Mars/Base", "", "+09:00", "KST"])("%j는 IANA 시간대가 아니라 거절한다", (raw) => {
    // When
    const create = () => TimeZone.create(raw);

    // Then
    expect(create).toThrow(
      expect.objectContaining({ errorCode: ErrorCode.SYS_0002, details: { field: "timeZone" } }),
    );
  });

  it("런타임이 아는 IANA 시간대는 정규 표기로 만든다", () => {
    // Given
    const raw = "asia/seoul";

    // When
    const timeZone = TimeZone.create(raw);

    // Then
    expect(timeZone.equals(TimeZone.SEOUL)).toBe(true);
  });

  it("UTC와 서울 기본값을 제공한다", () => {
    // Given
    const defaults = [TimeZone.UTC, TimeZone.SEOUL];

    // When
    const values = defaults.map((timeZone) => timeZone.value);

    // Then
    expect(values).toEqual(["UTC", "Asia/Seoul"]);
  });
});
