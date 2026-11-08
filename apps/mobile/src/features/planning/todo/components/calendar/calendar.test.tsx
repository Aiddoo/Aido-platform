import '@src/shared/i18n/init';
import { createMemoryObservableSyncStorage, renderUi } from '@src/shared/__tests__';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSyncExternalStore } from 'react';

import { createCalendarViewModeRepository } from '../../apis/calendar-view-mode.repository';
import type { CalendarViewMode } from '../../schemas/calendar-view-mode-storage.schema';
import { Calendar } from './calendar';

// 오늘과 겹치지 않게 지난 해의 날을 고른다
const SELECTED_DATE = '2020-03-11';
const DAYS_PER_MONTH_PAGE = 42;
const DATE_CELL_NAME = /^2020년 \d+월 \d+일$/;

/** expo-router처럼 URL이 바뀌면 param을 읽는 컴포넌트가 모두 다시 그려진다 */
function createRouteParamsStore(initial: Record<string, string>) {
  let params = initial;
  const listeners = new Set<() => void>();
  jest.mocked(useLocalSearchParams).mockImplementation(() =>
    useSyncExternalStore(
      (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      () => params,
    ),
  );
  jest.mocked(router.setParams).mockImplementation((next) => {
    const nextParams = new Map(Object.entries(params));
    Object.entries(next ?? {}).forEach(([key, value]) => {
      if (typeof value === 'string') {
        nextParams.set(key, value);
      } else {
        nextParams.delete(key);
      }
    });
    params = Object.fromEntries(nextParams);
    listeners.forEach((listener) => listener());
  });
}

async function renderCalendar(viewMode: CalendarViewMode) {
  createRouteParamsStore({ date: SELECTED_DATE });
  const syncStorage = createMemoryObservableSyncStorage();
  const viewModeRepository = createCalendarViewModeRepository(syncStorage);
  viewModeRepository.save(viewMode);
  await renderUi(<Calendar />, { di: { syncStorage }, withLocalDate: true });

  return { viewModeRepository };
}

function countRouteParamsReads() {
  return jest.mocked(useLocalSearchParams).mock.calls.length;
}

describe('Calendar', () => {
  it('월 보기를 처음 그릴 때 보이는 한 달만 그리고 route는 칸마다 읽지 않는다', async () => {
    // When
    await renderCalendar('month');

    // Then
    expect(screen.getAllByRole('button', { name: DATE_CELL_NAME })).toHaveLength(
      DAYS_PER_MONTH_PAGE,
    );
    // 쪽이 한 번 읽어 칸에 넘긴다. 칸마다 읽으면 42번을 넘는다
    expect(countRouteParamsReads()).toBeLessThan(DAYS_PER_MONTH_PAGE);
  });

  it('주에서 월로 바꾸면 한 달을 그리고 route는 칸마다 읽지 않는다', async () => {
    // Given
    const { viewModeRepository } = await renderCalendar('week');
    jest.mocked(useLocalSearchParams).mockClear();

    // When
    await act(() => viewModeRepository.save('month'));

    // Then
    expect(screen.getAllByRole('button', { name: DATE_CELL_NAME })).toHaveLength(
      DAYS_PER_MONTH_PAGE,
    );
    expect(countRouteParamsReads()).toBeLessThan(DAYS_PER_MONTH_PAGE);
  });

  it('월 보기에서 다른 날을 누르면 그 날을 URL에 담고 선택을 옮긴다', async () => {
    // Given
    await renderCalendar('month');
    jest.mocked(useLocalSearchParams).mockClear();

    // When
    await fireEvent.press(screen.getByRole('button', { name: '2020년 3월 12일' }));

    // Then
    expect(router.setParams).toHaveBeenCalledWith({ date: '2020-03-12' });
    expect(screen.getByRole('button', { name: '2020년 3월 12일' })).toBeSelected();
    expect(screen.getByRole('button', { name: '2020년 3월 11일' })).not.toBeSelected();
    expect(countRouteParamsReads()).toBeLessThan(DAYS_PER_MONTH_PAGE);
  });
});
