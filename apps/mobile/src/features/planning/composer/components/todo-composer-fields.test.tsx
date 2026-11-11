import '@src/shared/i18n/init';
import { ok } from '@src/core/errors/result';
import { createPreference } from '@src/features/identity/preference/__tests__/preference.fixtures';
import { PREFERENCE_QUERY_KEYS } from '@src/features/identity/preference/queries/preference-query-keys';
import { createTodoCategoryListDto } from '@src/features/planning/category/__tests__/todo-category.fixtures';
import { createHttpClientStub, createTestQueryClient, renderUi } from '@src/shared/__tests__';
import { fromDate } from '@src/shared/date/instant';
import { LocalDateProvider } from '@src/shared/providers/local-date-provider';
import { OverlayProvider } from '@src/shared/ui/overlay/overlay-provider';
import { screen } from '@testing-library/react-native';
import { useForm } from 'react-hook-form';

import type { AddTodoFormValues } from '../schemas/add-todo-form.schema';
import { TodoComposerChips } from './todo-composer-fields';

function ChipsHarness() {
  const form = useForm<AddTodoFormValues>({
    defaultValues: {
      title: '',
      startDate: fromDate(new Date('2026-10-27T00:00:00.000Z')),
      endDate: null,
      scheduledTime: '14:30',
      isAllDay: false,
      visibility: 'PUBLIC',
      categoryId: 1,
      repeat: null,
    },
  });

  return <TodoComposerChips form={form} />;
}

describe('TodoComposerChips', () => {
  it('12시간제 설정이면 시간 칩도 오후 표기로 보인다', async () => {
    // Given
    const queryClient = createTestQueryClient({
      defaultOptions: { queries: { staleTime: Infinity } },
    });
    queryClient.setQueryData(
      PREFERENCE_QUERY_KEYS.current(),
      createPreference({ timeFormat: 'TWELVE_HOUR' }),
    );

    const httpClient = createHttpClientStub();
    httpClient.get.mockResolvedValue(ok(createTodoCategoryListDto()));

    // When
    await renderUi(
      <LocalDateProvider>
        <OverlayProvider>
          <ChipsHarness />
        </OverlayProvider>
      </LocalDateProvider>,
      { queryClient, di: { httpClient } },
    );

    // Then
    expect(await screen.findByText('오후 2:30')).toBeTruthy();
  });
});
