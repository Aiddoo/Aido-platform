import { ErrorCode } from "@aido/api/errors";

import { TimeZone } from "#api/shared/domain/time/time-zone.vo";

import { resolveRecipientStartAfter } from "./broadcast-delivery.domain-service.js";
import { BroadcastDelivery } from "./broadcast-delivery.vo.js";

const SEOUL = TimeZone.create("Asia/Seoul");
const LOS_ANGELES = TimeZone.create("America/Los_Angeles");

function localTimeAt(date: string, localTime: string): BroadcastDelivery {
  return BroadcastDelivery.create({ mode: "RECIPIENT_LOCAL_TIME", localTime, date });
}

describe("resolveRecipientStartAfter — 수신자 현지 시각 발송", () => {
  // 서울 2026-11-10 09:00 = LA 2026-11-09 16:00
  const now = Temporal.Instant.from("2026-11-10T00:00:00Z");

  it("지금 발송이면 바로 보낸다(null)", () => {
    expect(
      resolveRecipientStartAfter({
        delivery: BroadcastDelivery.create({ mode: "NOW" }),
        timeZone: SEOUL,
        now,
      }),
    ).toBeNull();
  });

  it("같은 날짜·시각이라도 수신자 시간대마다 다른 순간에 보낸다", () => {
    // Given
    const delivery = localTimeAt("2026-11-11", "10:00");

    // Then - 서울 10:00(UTC 01:00), LA 10:00(UTC 18:00)
    expect(resolveRecipientStartAfter({ delivery, timeZone: SEOUL, now })?.toString()).toBe(
      "2026-11-11T01:00:00Z",
    );
    expect(resolveRecipientStartAfter({ delivery, timeZone: LOS_ANGELES, now })?.toString()).toBe(
      "2026-11-11T18:00:00Z",
    );
  });

  it("그 날짜·시각이 수신자에게 이미 지났으면 다음 날 같은 시각에 보낸다", () => {
    // Given - 서울은 지금 11-10 09:00이라 08:00은 이미 지났다
    const delivery = localTimeAt("2026-11-10", "08:00");

    // Then
    expect(resolveRecipientStartAfter({ delivery, timeZone: SEOUL, now })?.toString()).toBe(
      "2026-11-10T23:00:00Z",
    );
    // LA는 11-10 08:00이 아직 오지 않았다
    expect(resolveRecipientStartAfter({ delivery, timeZone: LOS_ANGELES, now })?.toString()).toBe(
      "2026-11-10T16:00:00Z",
    );
  });

  it("지난 날짜를 주면 수신자의 오늘부터 다음 그 시각을 고른다", () => {
    // Given
    const delivery = localTimeAt("2026-10-01", "10:00");

    // Then - 서울은 오늘 10:00(UTC 01:00)이 아직 오지 않았다
    expect(resolveRecipientStartAfter({ delivery, timeZone: SEOUL, now })?.toString()).toBe(
      "2026-11-10T01:00:00Z",
    );
  });

  it("서머타임이 시작되는 날 없는 시각은 전환 뒤로 보낸다", () => {
    // Given - LA 2027-03-14 02:30은 존재하지 않는다(02:00 → 03:00)
    const delivery = localTimeAt("2027-03-14", "02:30");

    // Then
    expect(
      resolveRecipientStartAfter({
        delivery,
        timeZone: LOS_ANGELES,
        now: Temporal.Instant.from("2027-03-01T00:00:00Z"),
      })?.toString(),
    ).toBe("2027-03-14T10:30:00Z");
  });
});

describe("BroadcastDelivery — 발송 시점 값", () => {
  it("시각·날짜 형식이 틀리면 SYS_0002로 거부한다", () => {
    expect(() => localTimeAt("2026-11-10", "25:99")).toThrow(
      expect.objectContaining({ errorCode: ErrorCode.SYS_0002 }),
    );
    expect(() => localTimeAt("not-a-date", "10:00")).toThrow(
      expect.objectContaining({ errorCode: ErrorCode.SYS_0002 }),
    );
  });

  it("저장 모양으로 왕복해도 같은 값이고 비어 있으면 지금 발송이다", () => {
    // Given
    const delivery = localTimeAt("2026-11-11", "10:00");

    // Then
    expect(BroadcastDelivery.reconstitute(delivery.toPrimitives()).equals(delivery)).toBe(true);
    expect(delivery.toPrimitives()).toEqual({
      mode: "RECIPIENT_LOCAL_TIME",
      localTime: "10:00",
      date: "2026-11-11",
    });
    expect(BroadcastDelivery.reconstitute(null).toPrimitives()).toEqual({ mode: "NOW" });
  });
});
