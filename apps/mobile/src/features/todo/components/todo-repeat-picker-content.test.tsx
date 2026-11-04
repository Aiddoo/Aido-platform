import '@src/shared/i18n/init';
import {
  createErrorReporterStub,
  createHapticsStub,
  createMockAnalytics,
} from '@src/shared/__tests__';
import { renderUi } from '@src/shared/__tests__/render-ui';
import { LocalDateProvider } from '@src/shared/providers/local-date-provider';
import { fireEvent, screen } from '@testing-library/react-native';

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
  const haptics = createHapticsStub();

  await renderUi(
    <LocalDateProvider>
      <TodoRepeatPickerContent
        value={{ startDate, repeat }}
        onChange={onChange}
        onCancel={onCancel}
      />
    </LocalDateProvider>,
    { di: { analytics: createMockAnalytics(), errorReporter: createErrorReporterStub(), haptics } },
  );

  return { onChange, onCancel, haptics };
}

const press = (text: string) => fireEvent.press(screen.getByText(text));
const confirm = () => press('확인');
const chip = (name: string) => screen.getByRole('button', { name });
const pressDay = (day: string) => fireEvent.press(chip(day));

describe('TodoRepeatPickerContent', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: new Date(2026, 10, 5, 9), advanceTimers: true });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('값이 없으면 시작일의 요일 하나와 날짜 종료로 시작하고 기간을 고를 때까지 확인이 막힌다', async () => {
    // Given
    const { onChange } = await renderSheet();

    // When
    await confirm();

    // Then
    expect(screen.getByText('* 매주 목 반복')).toBeTruthy();
    expect(screen.getByText('기간을 선택해주세요')).toBeTruthy();
    expect(chip('목')).toBeSelected();
    expect(onChange).not.toHaveBeenCalled();
  });

  test('계속을 고르면 기간 줄이 계속 반복으로 바뀌고 확인할 수 있다', async () => {
    // Given
    const { onChange } = await renderSheet();

    // When
    await press('계속');
    await confirm();

    // Then
    expect(screen.getByText('11월 5일 - 계속 반복')).toBeTruthy();
    expect(onChange).toHaveBeenCalledWith({
      startDate: START_DATE,
      repeat: WEEKLY_THURSDAY_FOREVER,
    });
  });

  test('요일을 고르면 매주 요약이 바뀌고 같은 요일을 다시 누르면 꺼진다', async () => {
    // Given
    await renderSheet();

    // When
    await pressDay('금');

    // Then
    expect(screen.getByText('* 매주 목, 금 반복')).toBeTruthy();

    // When
    await pressDay('금');

    // Then
    expect(screen.getByText('* 매주 목 반복')).toBeTruthy();
  });

  test('주중 프리셋은 월~금을 고르고 다시 누르면 요일이 비어 확인이 막힌다', async () => {
    // Given
    const { onChange } = await renderSheet();

    // When
    await press('주중');

    // Then
    expect(screen.getByText('* 주중 반복')).toBeTruthy();

    // When
    await press('주중');
    await confirm();

    // Then
    expect(screen.getByText('* 요일을 선택해주세요')).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
  });

  test('격주를 켜면 고른 요일을 유지한 채 2주 간격이 되고 다시 누르면 매주로 돌아온다', async () => {
    // Given
    const { onChange } = await renderSheet();

    // When
    await press('격주');

    // Then
    expect(screen.getByText('* 격주 목 반복')).toBeTruthy();
    expect(chip('목')).toBeSelected();

    // When
    await press('계속');
    await confirm();

    // Then
    expect(onChange).toHaveBeenCalledWith({
      startDate: START_DATE,
      repeat: { ...WEEKLY_THURSDAY_FOREVER, interval: 2 },
    });

    // When
    await press('격주');

    // Then
    expect(screen.getByText('* 매주 목 반복')).toBeTruthy();
  });

  test('매월 n일을 켜면 요일 선택이 꺼지고 시작일의 날짜로 매월 반복한다', async () => {
    // Given
    const { onChange } = await renderSheet();

    // When
    await press('매월 5일');
    await press('계속');
    await confirm();

    // Then
    expect(screen.getByText('* 매월 5일 반복')).toBeTruthy();
    expect(chip('목')).not.toBeSelected();
    expect(onChange).toHaveBeenCalledWith({
      startDate: START_DATE,
      repeat: { frequency: 'MONTHLY', monthDay: 5, end: { type: 'NEVER' } },
    });
  });

  test('요일을 누르면 매월이 꺼지고 그 요일만 고른 상태가 된다', async () => {
    // Given
    await renderSheet();
    await press('매월 5일');

    // When
    await pressDay('월');

    // Then
    expect(screen.getByText('* 매주 월 반복')).toBeTruthy();
    expect(chip('매월 5일')).not.toBeSelected();
  });

  test('횟수를 고르면 스테퍼가 나오고 기간 줄에 횟수가 보인다', async () => {
    // Given
    const { onChange } = await renderSheet();

    // When
    await press('횟수');
    await fireEvent.press(screen.getByLabelText('횟수 늘리기'));
    await confirm();

    // Then
    expect(screen.getByText('11회')).toBeTruthy();
    expect(screen.getByText('11월 5일부터 11회')).toBeTruthy();
    expect(onChange).toHaveBeenCalledWith({
      startDate: START_DATE,
      repeat: { ...WEEKLY_THURSDAY_FOREVER, end: { type: 'COUNT', count: 11 } },
    });
  });

  test('날짜 종료는 기간을 고를 때까지 확인이 막히고 달력에서 종료일을 고르면 풀린다', async () => {
    // Given
    const { onChange } = await renderSheet();

    // When
    await press('날짜');
    await confirm();

    // Then
    expect(screen.getByText('기간을 선택해주세요')).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();

    // When
    await press('12');
    await confirm();

    // Then
    expect(screen.getByText('11월 5일 - 11월 12일')).toBeTruthy();
    expect(onChange).toHaveBeenCalledWith({
      startDate: START_DATE,
      repeat: { ...WEEKLY_THURSDAY_FOREVER, end: { type: 'UNTIL', date: '2026-11-12' } },
    });
  });

  test('기간을 고른 뒤 달력을 다시 누르면 시작일을 새로 고르고 종료일은 비워진다', async () => {
    // Given
    await renderSheet();
    await press('날짜');
    await press('12');

    // When
    await press('19');

    // Then
    expect(screen.getByText('기간을 선택해주세요')).toBeTruthy();
    expect(screen.queryByText('11월 5일 - 11월 12일')).toBeNull();
  });

  test('날짜 종료 기간 안에 반복되는 날이 없으면 이유를 보여주고 확인이 막힌다', async () => {
    // Given
    const { onChange } = await renderSheet();
    await press('주말');

    // When
    await press('6');
    await confirm();

    // Then
    expect(screen.getByText('* 기간 안에 반복되는 날이 없어요')).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
  });

  test('시작일이 반복 요일이 아니면 기간 줄과 저장은 첫 회차 날짜를 쓴다', async () => {
    // Given
    const { onChange } = await renderSheet();
    await press('주말');

    // When
    await press('계속');
    await confirm();

    // Then
    expect(screen.getByText('11월 7일 - 계속 반복')).toBeTruthy();
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

  test('칩을 누르면 선택 햅틱을 준다', async () => {
    // Given
    const { haptics } = await renderSheet();

    // When
    await press('격주');

    // Then
    expect(haptics.selection).toHaveBeenCalledTimes(1);
  });

  test('계속이나 횟수에서 달력을 누르면 시작일이 바뀌고 매월 n일도 따라간다', async () => {
    // Given
    const { onChange } = await renderSheet();
    await press('매월 5일');
    await press('계속');

    // When
    await press('12');
    await confirm();

    // Then
    expect(screen.getByText('매월 12일')).toBeTruthy();
    expect(onChange).toHaveBeenCalledWith({
      startDate: new Date(2026, 10, 12),
      repeat: { frequency: 'MONTHLY', monthDay: 12, end: { type: 'NEVER' } },
    });
  });

  test('시작일이 29일 이후인 매월 반복은 말일 안내를 보여준다', async () => {
    // Given
    await renderSheet({ startDate: new Date(2026, 10, 29, 12) });

    // Then
    expect(screen.queryByText('그 날이 없는 달은 마지막 날에 반복해요')).toBeNull();

    // When
    await press('매월 29일');

    // Then
    expect(screen.getByText('그 날이 없는 달은 마지막 날에 반복해요')).toBeTruthy();
  });

  test('기존 반복이 있으면 삭제 버튼이 반복 없음으로 돌려준다', async () => {
    // Given
    const { onChange } = await renderSheet({ repeat: WEEKLY_THURSDAY_FOREVER });

    // When
    await press('삭제');

    // Then
    expect(onChange).toHaveBeenCalledWith({ startDate: START_DATE, repeat: null });
  });

  test('기존 반복이 없으면 삭제 버튼이 없다', async () => {
    // Given
    await renderSheet();

    // Then
    expect(screen.queryByText('삭제')).toBeNull();
  });
});
