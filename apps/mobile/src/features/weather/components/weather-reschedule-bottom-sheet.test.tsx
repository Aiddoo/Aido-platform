/**
 * @jest-environment <rootDir>/jest.time-zone-environment.cjs
 * @time-zone Asia/Seoul
 */
import '@src/shared/i18n/init';
import { SECOND_MS } from '@src/shared/constants/time-units';
import { ok } from '@src/shared/errors';
import { ThemeProvider } from '@src/shared/providers/theme-provider';
import { SheetRouteScreen } from '@src/shared/ui';
import {
  createAnalyticsStub,
  createMemoryObservableSyncStorage,
  createRouteParamsFake,
  createTestDi,
  getTrackedEvents,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { setupFakeTimersPerTest } from '@src/testing/timers';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { View } from 'react-native';

import {
  createBriefingDto,
  createHourlySeries,
  createRescheduleOptionDto,
  createWeatherReportDto,
} from '../__tests__/weather-report.fixtures';
import {
  createTodayTodoDto,
  createWeatherHttpClient,
  WEATHER_NOW,
} from '../__tests__/weather.test-utils';
import { WeatherRescheduleBottomSheet } from './weather-reschedule-bottom-sheet';

setupFakeTimersPerTest({ now: WEATHER_NOW });

/** 서울 16:30 산책이 16~18시 비와 겹친다 */
const WALK = createTodayTodoDto({ id: 7, title: '산책', localTime: '16:30' });

type HostNode = ReturnType<typeof screen.getByTestId>;

function findLayoutHost(node: HostNode): HostNode | null {
  if ('onLayout' in node.props) {
    return node;
  }
  for (const child of node.children) {
    const found = typeof child === 'string' ? null : findLayoutHost(child);
    if (found != null) {
      return found;
    }
  }
  return null;
}

/** router가 가짜라 닫아도 시트가 내려가지 않는다. 닫히는 애니메이션 동안의 화면이다 */
async function renderClosingSheet() {
  const report = createWeatherReportDto({
    hourly: createHourlySeries('2026-11-02T06:00:00.000Z', [10, 70, 80, 20, 10, 10]),
    briefing: createBriefingDto({
      reason: 'rain',
      affectedTodoIds: [WALK.id],
      rescheduleOptions: [
        {
          todoId: WALK.id,
          // 서울 18시
          options: [createRescheduleOptionDto('2026-11-02T09:00:00.000Z', { isRecommended: true })],
        },
      ],
    }),
  });
  const httpClient = createWeatherHttpClient({ report: ok(report), todos: [WALK] });
  httpClient.patch.mockResolvedValue(ok({ message: '수정했어요', todo: WALK }));
  const analytics = createAnalyticsStub();
  createRouteParamsFake({ todoIds: String(WALK.id), reason: 'rain' });
  await renderScreen(
    <ThemeProvider syncStorage={createMemoryObservableSyncStorage()}>
      <View testID="sheet-route">
        <SheetRouteScreen>
          <WeatherRescheduleBottomSheet />
        </SheetRouteScreen>
      </View>
    </ThemeProvider>,
    { di: createTestDi({ ports: { httpClient, analytics } }), withLocalDate: true },
  );
  const layoutHost = findLayoutHost(screen.getByTestId('sheet-route'));
  if (layoutHost != null) {
    await fireEvent(layoutHost, 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 844 } },
    });
  }
  return { httpClient, analytics };
}

describe('WeatherRescheduleBottomSheet', () => {
  it('옮겨 시트가 내려가는 동안 옮기기를 다시 눌러도 일정 변경은 한 번만 보낸다', async () => {
    // Given
    const { httpClient, analytics } = await renderClosingSheet();
    const submit = await screen.findByRole('button', { name: '1개 옮기기' });
    await fireEvent.press(submit);
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    // 연타 가드(600ms)가 지난 뒤다. 시트는 닫힘 애니메이션이 끝나야 내려가 버튼이 아직 보인다
    await act(() => jest.advanceTimersByTimeAsync(SECOND_MS));
    expect(httpClient.patch).toHaveBeenCalledTimes(1);

    // When
    await fireEvent.press(submit);
    await act(() => jest.advanceTimersByTimeAsync(SECOND_MS));

    // Then
    expect(submit).toBeDisabled();
    expect(httpClient.patch).toHaveBeenCalledTimes(1);
    expect(getTrackedEvents(analytics, 'weather_reschedule_applied')).toEqual([
      { moved_count: 1, reason: 'rain' },
    ]);
  });
});
