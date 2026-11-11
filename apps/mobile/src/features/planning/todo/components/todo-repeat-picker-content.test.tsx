import { instantFromDate } from '@src/shared/date/native-date';
import { LocalDateProvider } from '@src/shared/providers/local-date-provider';
import '@src/shared/i18n/init';
import {
  createErrorReporterStub,
  createHapticsGatewayStub,
  createAnalyticsStub,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { setupFakeTimersPerTest } from '@src/testing/timers';
import { screen, userEvent } from '@testing-library/react-native';

import type { TodoRepeat } from '../domains/todo-repeat.model';
import { TodoRepeatPickerContent } from './todo-repeat-picker-content';

const START_DATE = new Date(2026, 10, 5, 12);

const WEEKLY_THURSDAY_FOREVER: TodoRepeat = {
  frequency: 'WEEKLY',
  interval: 1,
  weekdays: ['THU'],
  end: { type: 'NEVER' },
};

async function renderSheet({
  repeat = null,
  startDate = START_DATE,
}: { repeat?: TodoRepeat | null; startDate?: Date } = {}) {
  const onChange = jest.fn();
  const onCancel = jest.fn();
  const haptics = createHapticsGatewayStub();

  await renderScreen(
    <LocalDateProvider>
      <TodoRepeatPickerContent
        value={{ startDate: instantFromDate(startDate), repeat }}
        onChange={onChange}
        onCancel={onCancel}
      />
    </LocalDateProvider>,
    { di: { analytics: createAnalyticsStub(), errorReporter: createErrorReporterStub(), haptics } },
  );

  return { onChange, onCancel, haptics };
}

const chip = (name: string) => screen.getByRole('button', { name });
const press = (text: string) => userEvent.press(screen.getByText(text));
const confirm = () => press('확인');
const pressDay = (day: string) => userEvent.press(chip(day));

describe('TodoRepeatPickerContent', () => {
  setupFakeTimersPerTest({ now: new Date(2026, 10, 5, 9), advanceTimers: true });

  it('값이 없으면 시작일의 요일 하나와 날짜 종료로 시작하고 기간을 고를 때까지 확인이 막힌다', async () => {
    // Given
    const { onChange } = await renderSheet();

    // When
    await confirm();

    // Then
    expect(screen.getByText('매주 목 반복')).toBeOnTheScreen();
    expect(screen.getByText('기간을 선택해주세요')).toBeOnTheScreen();
    expect(chip('목')).toBeSelected();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('계속 반복을 켜면 기간 줄이 계속으로 바뀌고 확인할 수 있으며 다시 누르면 기간 선택으로 돌아간다', async () => {
    // Given
    const { onChange } = await renderSheet();

    // When
    await press('계속 반복');
    await confirm();

    // Then
    expect(screen.getByText('11월 5일부터 계속')).toBeOnTheScreen();
    expect(onChange).toHaveBeenCalledWith({
      startDate: instantFromDate(START_DATE),
      repeat: WEEKLY_THURSDAY_FOREVER,
    });
  });

  it('요일을 고르면 매주 요약이 바뀌고 같은 요일을 다시 누르면 꺼진다', async () => {
    // Given
    await renderSheet();

    // When
    await pressDay('금');

    // Then
    expect(screen.getByText('매주 목, 금 반복')).toBeOnTheScreen();

    // When
    await pressDay('금');

    // Then
    expect(screen.getByText('매주 목 반복')).toBeOnTheScreen();
  });

  it('주중 프리셋은 월~금을 고르고 다시 누르면 요일이 비어 확인이 막힌다', async () => {
    // Given
    const { onChange } = await renderSheet();

    // When
    await press('주중');

    // Then
    expect(screen.getByText('주중 반복')).toBeOnTheScreen();

    // When
    await press('주중');
    await confirm();

    // Then
    expect(screen.getByText('요일을 선택해주세요')).toBeOnTheScreen();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('격주를 켜면 고른 요일을 유지한 채 2주 간격이 되고 다시 누르면 매주로 돌아온다', async () => {
    // Given
    const { onChange } = await renderSheet();

    // When
    await press('격주');

    // Then
    expect(screen.getByText('격주 목 반복')).toBeOnTheScreen();
    expect(chip('목')).toBeSelected();

    // When
    await press('계속 반복');
    await confirm();

    // Then
    expect(onChange).toHaveBeenCalledWith({
      startDate: instantFromDate(START_DATE),
      repeat: { ...WEEKLY_THURSDAY_FOREVER, interval: 2 },
    });

    // When
    await press('격주');

    // Then
    expect(screen.getByText('매주 목 반복')).toBeOnTheScreen();
  });

  it('매월 n일을 켜면 요일 선택이 꺼지고 시작일의 날짜로 매월 반복한다', async () => {
    // Given
    const { onChange } = await renderSheet();

    // When
    await press('매월 5일');
    await press('계속 반복');
    await confirm();

    // Then
    expect(screen.getByText('매월 5일 반복')).toBeOnTheScreen();
    expect(chip('목')).not.toBeSelected();
    expect(onChange).toHaveBeenCalledWith({
      startDate: instantFromDate(START_DATE),
      repeat: { frequency: 'MONTHLY', monthDay: 5, end: { type: 'NEVER' } },
    });
  });

  it('요일을 누르면 매월이 꺼지고 그 요일만 고른 상태가 된다', async () => {
    // Given
    await renderSheet();
    await press('매월 5일');

    // When
    await pressDay('월');

    // Then
    expect(screen.getByText('매주 월 반복')).toBeOnTheScreen();
    expect(chip('매월 5일')).not.toBeSelected();
  });

  it('말로 만든 횟수 반복을 열면 횟수를 보이고 그대로 저장하며 계속 반복 버튼으로 바꿀 수 있다', async () => {
    // Given
    const counted: TodoRepeat = {
      ...WEEKLY_THURSDAY_FOREVER,
      end: { type: 'COUNT', count: 10 },
    };
    const { onChange } = await renderSheet({ repeat: counted });

    // When
    await confirm();

    // Then
    expect(screen.getByText('11월 5일부터 10회')).toBeOnTheScreen();
    expect(onChange).toHaveBeenCalledWith({
      startDate: instantFromDate(START_DATE),
      repeat: counted,
    });

    // When
    await press('계속 반복');

    // Then
    expect(screen.getByText('11월 5일부터 계속')).toBeOnTheScreen();
  });

  it('계속 상태에서 시작일 뒤 날짜를 누르면 그날까지 날짜 종료가 된다', async () => {
    // Given
    const { onChange } = await renderSheet();
    await press('계속 반복');

    // When
    await press('12');
    await confirm();

    // Then
    expect(screen.getByText('11월 5일 - 11월 12일')).toBeOnTheScreen();
    expect(onChange).toHaveBeenCalledWith({
      startDate: instantFromDate(START_DATE),
      repeat: { ...WEEKLY_THURSDAY_FOREVER, end: { type: 'UNTIL', date: '2026-11-12' } },
    });
  });

  it('날짜 종료는 기간을 고를 때까지 확인이 막히고 달력에서 종료일을 고르면 풀린다', async () => {
    // Given
    const { onChange } = await renderSheet();

    // When
    await confirm();

    // Then
    expect(screen.getByText('기간을 선택해주세요')).toBeOnTheScreen();
    expect(onChange).not.toHaveBeenCalled();

    // When
    await press('12');
    await confirm();

    // Then
    expect(screen.getByText('11월 5일 - 11월 12일')).toBeOnTheScreen();
    expect(onChange).toHaveBeenCalledWith({
      startDate: instantFromDate(START_DATE),
      repeat: { ...WEEKLY_THURSDAY_FOREVER, end: { type: 'UNTIL', date: '2026-11-12' } },
    });
  });

  it('기간을 고른 뒤 달력을 다시 누르면 시작일을 새로 고르고 종료일은 비워진다', async () => {
    // Given
    await renderSheet();
    await press('12');

    // When
    await press('19');

    // Then
    expect(screen.getByText('기간을 선택해주세요')).toBeOnTheScreen();
    expect(screen.queryByText('11월 5일 - 11월 12일')).toBeNull();
  });

  it('날짜 종료 기간 안에 반복되는 날이 없으면 이유를 보여주고 확인이 막힌다', async () => {
    // Given
    const { onChange } = await renderSheet();
    await press('주말');

    // When
    await press('6');
    await confirm();

    // Then
    expect(screen.getByText('기간 안에 반복되는 날이 없어요')).toBeOnTheScreen();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('시작일이 반복 요일이 아니면 기간 줄과 저장은 첫 회차 날짜를 쓴다', async () => {
    // Given
    const { onChange } = await renderSheet();
    await press('주말');

    // When
    await press('계속 반복');
    await confirm();

    // Then
    expect(screen.getByText('11월 7일부터 계속')).toBeOnTheScreen();
    expect(onChange).toHaveBeenCalledWith({
      startDate: instantFromDate(START_DATE),
      repeat: {
        frequency: 'WEEKLY',
        interval: 1,
        weekdays: ['SAT', 'SUN'],
        end: { type: 'NEVER' },
      },
    });
  });

  it('시작일이 반복 요일이 아니면 달력의 시작 원은 첫 회차 날짜에 그린다', async () => {
    // Given
    await renderSheet();

    // When
    await press('주말');

    // Then
    const isSelectedCircle = (day: string) =>
      /(^|\s)bg-main(\s|$)/.test(screen.getByText(day).parent?.props.className ?? '');
    expect(isSelectedCircle('7')).toBe(true);
    expect(isSelectedCircle('5')).toBe(false);
  });

  it('첫 회차 원을 누르면 그날을 시작일로 고른 것으로 본다', async () => {
    // Given
    const { onChange } = await renderSheet();
    await press('주말');
    await press('계속 반복');

    // When
    await press('7');
    await confirm();

    // Then
    expect(screen.getByText('11월 7일부터 계속')).toBeOnTheScreen();
    expect(onChange).toHaveBeenCalledWith({
      startDate: instantFromDate(new Date(2026, 10, 7)),
      repeat: {
        frequency: 'WEEKLY',
        interval: 1,
        weekdays: ['SAT', 'SUN'],
        end: { type: 'NEVER' },
      },
    });
  });

  it('시작일을 새로 고르면 매월 n일도 따라간다', async () => {
    // Given
    const { onChange } = await renderSheet();
    await press('매월 5일');
    await press('12');

    // When
    await press('19');
    await press('26');
    await confirm();

    // Then
    expect(screen.getByText('매월 19일')).toBeOnTheScreen();
    expect(onChange).toHaveBeenCalledWith({
      startDate: instantFromDate(new Date(2026, 10, 19)),
      repeat: { frequency: 'MONTHLY', monthDay: 19, end: { type: 'UNTIL', date: '2026-11-26' } },
    });
  });

  it('매월 31일 규칙을 2월 28일 회차에서 열어 확인만 눌러도 31일을 유지한다', async () => {
    // Given
    const startDate = new Date(2027, 1, 28, 12);
    const repeat: TodoRepeat = { frequency: 'MONTHLY', monthDay: 31, end: { type: 'NEVER' } };
    const { onChange } = await renderSheet({ startDate, repeat });

    // When
    await confirm();

    // Then
    expect(screen.getByText('매월 31일')).toBeOnTheScreen();
    expect(onChange).toHaveBeenCalledWith({ startDate: instantFromDate(startDate), repeat });
  });

  it('매월 31일 규칙도 시작일을 직접 옮기면 옮긴 날을 따른다', async () => {
    // Given
    const repeat: TodoRepeat = { frequency: 'MONTHLY', monthDay: 31, end: { type: 'NEVER' } };
    const { onChange } = await renderSheet({ repeat, startDate: new Date(2026, 10, 30, 12) });

    // When
    await press('19');
    await confirm();

    // Then
    expect(screen.getByText('매월 19일')).toBeOnTheScreen();
    expect(onChange).toHaveBeenLastCalledWith({
      startDate: instantFromDate(new Date(2026, 10, 19)),
      repeat: expect.objectContaining({ frequency: 'MONTHLY', monthDay: 19 }),
    });
  });

  it('월요일만 고르고 목~토(5~7일)를 기간으로 잡으면 뒤집힌 띠 없이 고른 기간과 이유를 보여준다', async () => {
    // Given
    await renderSheet();
    await pressDay('월');
    await pressDay('목');

    // When
    await press('7');

    // Then
    expect(screen.getByText('기간 안에 반복되는 날이 없어요')).toBeOnTheScreen();
    expect(screen.getByText('11월 5일 - 11월 7일')).toBeOnTheScreen();
  });

  it('시작일이 29일 이후인 매월 반복은 말일 안내를 보여준다', async () => {
    // Given
    await renderSheet({ startDate: new Date(2026, 10, 29, 12) });

    // Then
    expect(screen.queryByText('그 날이 없는 달은 마지막 날에 반복해요')).toBeNull();

    // When
    await press('매월 29일');

    // Then
    expect(screen.getByText('그 날이 없는 달은 마지막 날에 반복해요')).toBeOnTheScreen();
  });

  it('기존 반복이 있으면 삭제 버튼이 반복 없음으로 돌려준다', async () => {
    // Given
    const { onChange } = await renderSheet({ repeat: WEEKLY_THURSDAY_FOREVER });

    // When
    await press('삭제');

    // Then
    expect(onChange).toHaveBeenCalledWith({ startDate: instantFromDate(START_DATE), repeat: null });
  });

  it('기존 반복이 없으면 삭제 버튼이 없다', async () => {
    // When
    await renderSheet();

    // Then
    expect(screen.queryByText('삭제')).toBeNull();
  });
});
