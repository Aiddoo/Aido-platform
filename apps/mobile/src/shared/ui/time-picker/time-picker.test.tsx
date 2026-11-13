/**
 * @jest-environment <rootDir>/jest.time-zone-environment.cjs
 * @time-zone America/New_York
 */
import type { TimeOfDay } from '@src/shared/date/time-of-day';
import { setupFakeTimersPerTest } from '@src/testing/timers';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { TimeSpinner } from './time-picker';

// 뉴욕 서머타임 시작일. 이날 02:00~02:59는 없는 시각이라 오늘 날짜에 시각을 얹으면 한 시간 밀린다
const DST_START_DAY = new Date(2026, 2, 8, 12);

setupFakeTimersPerTest({ now: DST_START_DAY });

async function pickShownTime(value: TimeOfDay) {
  const onChange = jest.fn();
  await render(
    <TimeSpinner testID="spinner" value={value} onChange={onChange} timeFormat="TWELVE_HOUR" />,
  );
  const spinner = screen.getByTestId('spinner');
  await fireEvent(spinner, 'change', { nativeEvent: { timestamp: spinner.props.date } });

  return { onChange, pickerDate: new Date(spinner.props.date) };
}

describe('TimeSpinner', () => {
  it.each([
    { hour: 0, minute: 0 },
    { hour: 1, minute: 59 },
    { hour: 2, minute: 0 },
    { hour: 2, minute: 30 },
    { hour: 3, minute: 0 },
    { hour: 23, minute: 59 },
  ])('서머타임 시작일에도 $hour시 $minute분을 그대로 돌려준다', async (time) => {
    // When
    const { onChange } = await pickShownTime(time);

    // Then
    expect(onChange).toHaveBeenCalledWith(time);
  });

  it('피커 날짜는 오늘과 무관한 고정 날짜라 오늘이 전환일이어도 시각을 옮기지 않는다', async () => {
    // When
    const { pickerDate } = await pickShownTime({ hour: 2, minute: 30 });

    // Then
    expect(pickerDate.toDateString()).not.toBe(DST_START_DAY.toDateString());
    expect([pickerDate.getHours(), pickerDate.getMinutes()]).toEqual([2, 30]);
  });
});
