import { WindowedCounter } from "./windowed-counter.js";

const HOUR_MS = 3_600_000;

describe("WindowedCounter", () => {
  it("같은 창 안에서는 키별로 누적한다", () => {
    // Given
    const counter = new WindowedCounter(HOUR_MS);

    // When
    counter.add("a", 0);
    counter.add("b", 10);
    const count = counter.add("a", HOUR_MS - 1);

    // Then
    expect(count).toBe(2);
  });

  it("창 길이가 지나면 모든 키를 0부터 다시 센다", () => {
    // Given
    const counter = new WindowedCounter(HOUR_MS);
    counter.add("a", 0);
    counter.add("a", 1);

    // When
    const count = counter.add("a", HOUR_MS);

    // Then
    expect(count).toBe(1);
  });

  it("키 상한을 넘은 새 키는 저장하지 않고 매번 1로 센다", () => {
    // Given
    const counter = new WindowedCounter(HOUR_MS, 1);
    counter.add("a", 0);

    // When
    counter.add("b", 1);
    const count = counter.add("b", 2);

    // Then
    expect(count).toBe(1);
    expect(counter.add("a", 3)).toBe(2);
  });
});
