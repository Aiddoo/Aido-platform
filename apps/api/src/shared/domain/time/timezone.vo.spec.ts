import { ErrorCode } from "@aido/api/errors";

import { Timezone } from "./timezone.vo.js";

describe("Timezone — 시간대", () => {
  it.each(["Mars/Base", "", "+09:00", "KST"])("%j는 IANA 시간대가 아니라 거절한다", (raw) => {
    // When
    const create = () => Timezone.create(raw);

    // Then
    expect(create).toThrow(
      expect.objectContaining({ errorCode: ErrorCode.SYS_0002, details: { field: "timeZone" } }),
    );
  });

  it("런타임이 아는 IANA 시간대는 정규 표기로 만든다", () => {
    // Given
    const raw = "asia/seoul";

    // When
    const timezone = Timezone.create(raw);

    // Then
    expect(timezone.value).toBe("Asia/Seoul");
  });

  it.each(["Asia/Calcutta", "US/Pacific", "Etc/UTC"])(
    "옛 이름·별칭 %s는 다른 이름으로 바꾸지 않고 그대로 만든다",
    (raw) => {
      // When
      const timezone = Timezone.create(raw);

      // Then
      expect(timezone.value).toBe(raw);
    },
  );
});
