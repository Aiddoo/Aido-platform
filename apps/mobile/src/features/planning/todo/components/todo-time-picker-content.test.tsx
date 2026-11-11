import { createPreference } from '@src/features/identity/preference/__tests__/preference.fixtures';
import '@src/shared/i18n/init';
import { PREFERENCE_QUERY_KEYS } from '@src/features/identity/preference/queries/preference-query-keys';
import {
  createErrorReporterStub,
  createHapticsGatewayStub,
  createAnalyticsStub,
  createTestQueryClient,
  renderUi,
} from '@src/shared/__tests__';
import { LocalDateProvider } from '@src/shared/providers/local-date-provider';
import { fireEvent, screen } from '@testing-library/react-native';

import { TodoTimePickerContent } from './todo-time-picker-content';

async function renderSheet({ isAllDay }: { isAllDay: boolean }) {
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  queryClient.setQueryData(
    PREFERENCE_QUERY_KEYS.current(),
    createPreference({ timeFormat: 'TWELVE_HOUR' }),
  );

  await renderUi(
    <LocalDateProvider>
      <TodoTimePickerContent
        date={new Date(2026, 10, 6, 12)}
        value={{ scheduledTime: isAllDay ? null : '10:00', isAllDay }}
        onChange={jest.fn()}
        onCancel={jest.fn()}
      />
    </LocalDateProvider>,
    {
      queryClient,
      di: {
        analytics: createAnalyticsStub(),
        errorReporter: createErrorReporterStub(),
        haptics: createHapticsGatewayStub(),
      },
    },
  );
}

describe('TodoTimePickerContent 알림 안내', () => {
  it('시간이 있으면 1시간 전과 10분 전에 알린다고 안내한다', async () => {
    // Given
    await renderSheet({ isAllDay: false });

    // When
    const info = await screen.findByText(/1시간 전, 10분 전/);

    // Then
    expect(info).toBeTruthy();
  });

  it('종일이면 서버가 알림을 잡지 않으므로 보내지 않는다고 안내하고 시간을 고르면 바뀐다', async () => {
    // Given
    await renderSheet({ isAllDay: true });
    expect(await screen.findByText(/종일 할 일은 알림을 보내지 않아요/)).toBeTruthy();
    expect(screen.queryByText(/1시간 전, 10분 전/)).toBeNull();

    // When
    await fireEvent.press(screen.getByText('시간 선택'));

    // Then
    expect(screen.getByText(/1시간 전, 10분 전/)).toBeTruthy();
  });
});
