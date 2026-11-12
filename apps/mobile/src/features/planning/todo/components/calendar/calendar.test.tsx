import '@src/shared/i18n/init';
import { writeStoredValue } from '@src/shared/storage/define-stored-value';
import {
  createMemoryObservableSyncStorage,
  createRouteParamsFake,
  createTestDi,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { fireEvent, screen } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';

import {
  type CalendarViewMode,
  calendarViewModeStoredValue,
} from '../../schemas/calendar-view-mode-storage.schema';
import { Calendar } from './calendar';

// 오늘과 겹치지 않게 지난 해의 날을 고른다
const SELECTED_DATE = '2020-03-11';
const DAYS_PER_MONTH_PAGE = 42;

async function renderCalendar(viewMode: CalendarViewMode) {
  createRouteParamsFake({ date: SELECTED_DATE });
  const syncStorage = createMemoryObservableSyncStorage();
  writeStoredValue(syncStorage, calendarViewModeStoredValue, viewMode);
  await renderScreen(<Calendar />, {
    di: createTestDi({ ports: { syncStorage } }),
    withLocalDate: true,
  });

  return { syncStorage };
}

function countRouteParamsReads() {
  return jest.mocked(useLocalSearchParams).mock.calls.length;
}

describe('Calendar', () => {
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
