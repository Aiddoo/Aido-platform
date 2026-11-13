import { range } from 'es-toolkit';

import { getPickerTimeOfDay, toPickerDate } from './native-date';

describe('toPickerDate', () => {
  it('하루의 모든 시각이 피커에서 같은 시와 분으로 돌아온다', () => {
    // Given
    const times = range(24).flatMap((hour) => [0, 30, 59].map((minute) => ({ hour, minute })));

    // When
    const roundTrips = times.map((time) => getPickerTimeOfDay(toPickerDate(time)));

    // Then
    expect(roundTrips).toEqual(times);
  });

  it('초와 밀리초는 0이다', () => {
    // When
    const result = toPickerDate({ hour: 9, minute: 0 });

    // Then
    expect([result.getSeconds(), result.getMilliseconds()]).toEqual([0, 0]);
  });
});
