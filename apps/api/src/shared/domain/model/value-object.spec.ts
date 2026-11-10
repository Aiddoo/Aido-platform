import { compareTemporal, ValueObject } from "./value-object.js";

class Title extends ValueObject<string> {
  static of(raw: string): Title {
    return new Title(raw);
  }
}

class Label extends ValueObject<string> {
  static of(raw: string): Label {
    return new Label(raw);
  }
}

class OccurredAt extends ValueObject<Temporal.Instant> {
  static of(instant: Temporal.Instant): OccurredAt {
    return new OccurredAt(instant);
  }
}

interface ScheduleValue {
  readonly date: Temporal.PlainDate;
  readonly time: Temporal.PlainTime | null;
}

class Schedule extends ValueObject<ScheduleValue> {
  static of(value: ScheduleValue): Schedule {
    return new Schedule(value);
  }
}

describe("ValueObject — 값 객체 베이스", () => {
  it("같은 클래스의 같은 원시 값은 같다", () => {
    // Given
    const left = Title.of("장보기");

    // When
    const isEqual = left.equals(Title.of("장보기"));

    // Then
    expect(isEqual).toBe(true);
  });

  it("값이 같아도 클래스가 다르면 다르다", () => {
    // Given
    const title = Title.of("장보기");

    // When
    const isEqual = title.equals(Label.of("장보기"));

    // Then
    expect(isEqual).toBe(false);
  });

  it("같은 순간을 가리키는 서로 다른 Temporal.Instant 객체는 같다", () => {
    // Given
    const left = OccurredAt.of(Temporal.Instant.from("2026-11-10T00:00:00Z"));
    const right = OccurredAt.of(Temporal.Instant.fromEpochMilliseconds(1_794_268_800_000));

    // When
    const isEqual = left.equals(right);

    // Then
    expect(isEqual).toBe(true);
  });

  it("다른 순간의 Temporal.Instant는 다르다", () => {
    // Given
    const left = OccurredAt.of(Temporal.Instant.from("2026-11-10T00:00:00Z"));
    const right = OccurredAt.of(Temporal.Instant.from("2026-11-10T00:00:00.001Z"));

    // When
    const isEqual = left.equals(right);

    // Then
    expect(isEqual).toBe(false);
  });

  it("PlainDate를 담은 객체 값은 날짜가 같으면 같고 다르면 다르다", () => {
    // Given
    const base = Schedule.of({ date: Temporal.PlainDate.from("2026-11-10"), time: null });
    const sameDate = Schedule.of({ date: new Temporal.PlainDate(2_026, 11, 10), time: null });
    const nextDate = Schedule.of({ date: Temporal.PlainDate.from("2026-11-11"), time: null });

    // When
    const results = [base.equals(sameDate), base.equals(nextDate)];

    // Then
    expect(results).toEqual([true, false]);
  });

  it("객체 값은 만든 뒤 바꿀 수 없다", () => {
    // Given
    const schedule = Schedule.of({ date: Temporal.PlainDate.from("2026-11-10"), time: null });

    // When
    const isFrozen = Object.isFrozen(schedule.value);

    // Then
    expect(isFrozen).toBe(true);
  });
});

describe("compareTemporal — Temporal 값 비교", () => {
  it("둘 다 Temporal 값이 아니면 기본 비교에 맡긴다", () => {
    // Given
    const pairs: ReadonlyArray<readonly [unknown, unknown]> = [
      [1, 1],
      ["a", "b"],
      [{ a: 1 }, { a: 1 }],
    ];

    // When
    const results = pairs.map(([left, right]) => compareTemporal(left, right));

    // Then
    expect(results).toEqual([undefined, undefined, undefined]);
  });

  it("종류가 다른 Temporal 값이나 Temporal과 일반 값은 다르다", () => {
    // Given
    const date = Temporal.PlainDate.from("2026-11-10");
    const dateTime = Temporal.PlainDateTime.from("2026-11-10T00:00");

    // When
    const results = [compareTemporal(date, dateTime), compareTemporal(date, "2026-11-10")];

    // Then
    expect(results).toEqual([false, false]);
  });

  it("같은 벽시계 시각의 PlainTime은 같다", () => {
    // Given
    const left = Temporal.PlainTime.from("09:30");
    const right = new Temporal.PlainTime(9, 30);

    // When
    const isEqual = compareTemporal(left, right);

    // Then
    expect(isEqual).toBe(true);
  });
});
