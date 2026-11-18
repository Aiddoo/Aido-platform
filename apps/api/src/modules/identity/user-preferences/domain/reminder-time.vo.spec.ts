/**
 * ReminderTime 불변식 단위 테스트
 */
import { ReminderTime } from "./reminder-time.vo.js";

describe("ReminderTime.create — 리마인더 시간 범위", () => {
  it("아침 리마인더가 12시 이상이면 PREFERENCE_1702", () => {
    // When
    const create = () => ReminderTime.create({ morningReminderHour: 13 });

    // Then
    expect(create).toThrow(expect.objectContaining({ errorCode: "PREFERENCE_1702" }));
  });

  it("저녁 리마인더가 12시 미만이면 PREFERENCE_1702", () => {
    // When
    const create = () => ReminderTime.create({ eveningReminderHour: 11 });

    // Then
    expect(create).toThrow(expect.objectContaining({ errorCode: "PREFERENCE_1702" }));
  });

  it("유효 범위(오전 0-11, 오후 12-23)는 통과", () => {
    // When
    const create = () =>
      ReminderTime.create({
        morningReminderHour: 11,
        eveningReminderHour: 12,
      });

    // Then
    expect(create).not.toThrow();
  });

  it("미지정 필드는 검증하지 않는다", () => {
    // When
    const create = () => ReminderTime.create({});

    // Then
    expect(create).not.toThrow();
  });
});
