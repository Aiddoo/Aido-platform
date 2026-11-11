import type { DateKey } from '@src/shared/date/date-key';
import { LocalDateProvider } from '@src/shared/providers/local-date-provider';
import {
  createErrorReporterStub,
  createHapticsGatewayStub,
  createAnalyticsStub,
} from '@src/testing/core';
import '@src/shared/i18n/init';
import { createDateKey } from '@src/testing/date-key';
import { renderScreen } from '@src/testing/render';
import { setupFakeTimersPerTest } from '@src/testing/timers';
import { screen, userEvent } from '@testing-library/react-native';

import type { TodoRepeat } from '../domains/todo-repeat.model';
import { TodoRepeatPicker } from './todo-repeat-picker';

const START_DATE = createDateKey('2026-11-05');

const WEEKLY_THURSDAY_FOREVER: TodoRepeat = {
  frequency: 'WEEKLY',
  interval: 1,
  weekdays: ['THU'],
  end: { type: 'NEVER' },
};

async function renderSheet({
  repeat = null,
  startDate = START_DATE,
}: { repeat?: TodoRepeat | null; startDate?: DateKey } = {}) {
  const onChange = jest.fn();
  const onCancel = jest.fn();
  const haptics = createHapticsGatewayStub();

  await renderScreen(
    <LocalDateProvider>
      <TodoRepeatPicker value={{ startDate, repeat }} onChange={onChange} onCancel={onCancel} />
    </LocalDateProvider>,
    { di: { analytics: createAnalyticsStub(), errorReporter: createErrorReporterStub(), haptics } },
  );

  return { onChange, onCancel, haptics };
}

const chip = (name: string) => screen.getByRole('button', { name });
const press = (text: string) => userEvent.press(screen.getByText(text));
const confirm = () => press('확인');

describe('TodoRepeatPicker', () => {
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
      startDate: START_DATE,
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
      startDate: START_DATE,
      repeat: { frequency: 'MONTHLY', monthDay: 5, end: { type: 'NEVER' } },
    });
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
      startDate: START_DATE,
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
      startDate: START_DATE,
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
      startDate: START_DATE,
      repeat: { ...WEEKLY_THURSDAY_FOREVER, end: { type: 'UNTIL', date: '2026-11-12' } },
    });
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
      startDate: START_DATE,
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
      startDate: createDateKey('2026-11-19'),
      repeat: { frequency: 'MONTHLY', monthDay: 19, end: { type: 'UNTIL', date: '2026-11-26' } },
    });
  });

  it('매월 31일 규칙을 2월 28일 회차에서 열어 확인만 눌러도 31일을 유지한다', async () => {
    // Given
    const startDate = createDateKey('2027-02-28');
    const repeat: TodoRepeat = { frequency: 'MONTHLY', monthDay: 31, end: { type: 'NEVER' } };
    const { onChange } = await renderSheet({ startDate, repeat });

    // When
    await confirm();

    // Then
    expect(screen.getByText('매월 31일')).toBeOnTheScreen();
    expect(onChange).toHaveBeenCalledWith({ startDate, repeat });
  });

  it('매월 31일 규칙도 시작일을 직접 옮기면 옮긴 날을 따른다', async () => {
    // Given
    const repeat: TodoRepeat = { frequency: 'MONTHLY', monthDay: 31, end: { type: 'NEVER' } };
    const { onChange } = await renderSheet({ repeat, startDate: createDateKey('2026-11-30') });

    // When
    await press('19');
    await confirm();

    // Then
    expect(screen.getByText('매월 19일')).toBeOnTheScreen();
    expect(onChange).toHaveBeenLastCalledWith({
      startDate: createDateKey('2026-11-19'),
      repeat: expect.objectContaining({ frequency: 'MONTHLY', monthDay: 19 }),
    });
  });

  it('기존 반복이 있으면 삭제 버튼이 반복 없음으로 돌려준다', async () => {
    // Given
    const { onChange } = await renderSheet({ repeat: WEEKLY_THURSDAY_FOREVER });

    // When
    await press('삭제');

    // Then
    expect(onChange).toHaveBeenCalledWith({ startDate: START_DATE, repeat: null });
  });
});
