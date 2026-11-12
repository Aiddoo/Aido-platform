import '@src/shared/i18n/init';
import { PLAN_CATALOG } from '@aido/api/vocabulary';
import { StaticDIProvider } from '@src/bootstrap/providers/di-context';
import { GestureHandlerProvider } from '@src/bootstrap/providers/gesture-handler-provider';
import { HeroUIProvider } from '@src/bootstrap/providers/hero-ui-provider';
import { ok } from '@src/core/errors/result';
import { createEntitlementSnapshotDto } from '@src/features/billing/subscription/__tests__/entitlement.fixtures';
import { FontScaleProvider } from '@src/shared/providers/font-scale-provider';
import { LocalDateProvider } from '@src/shared/providers/local-date-provider';
import { OverlayProvider } from '@src/shared/ui/overlay/overlay-provider';
import {
  createAnalyticsStub,
  createHttpClientStub,
  createAppLoggerStub,
  createTestDi,
  createTestQueryClient,
} from '@src/testing/core';
import { setupFakeTimersPerTest } from '@src/testing/timers';
import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { View } from 'react-native';

import { QuickVoiceQuota } from './quick-voice-quota';

let silentLogger: ReturnType<typeof createAppLoggerStub>;

beforeEach(() => {
  silentLogger = createAppLoggerStub();
});

describe('QuickVoiceQuota', () => {
  it('앱처럼 HeroUIProvider가 DI·Query 바깥에 있어도 ⓘ를 누르면 죽지 않고 남은 횟수를 보여 준다', async () => {
    // Given
    jest.spyOn(View.prototype, 'measure').mockImplementation((callback) => {
      if (typeof callback === 'function') {
        callback(0, 0, 200, 20, 16, 300);
      }
    });
    const httpClient = createHttpClientStub();
    httpClient.get.mockResolvedValue(ok(createEntitlementSnapshotDto()));
    await render(
      <GestureHandlerProvider>
        <FontScaleProvider>
          <HeroUIProvider
            config={{ animation: 'disable-all', devInfo: { stylingPrinciples: false } }}
          >
            <QueryClientProvider client={createTestQueryClient()}>
              <StaticDIProvider
                container={createTestDi({ ports: { httpClient, logger: silentLogger } })}
              >
                <LocalDateProvider>
                  <QuickVoiceQuota />
                </LocalDateProvider>
              </StaticDIProvider>
            </QueryClientProvider>
          </HeroUIProvider>
        </FontScaleProvider>
      </GestureHandlerProvider>,
    );

    // When
    await fireEvent.press(await screen.findByTestId('todo-ai-feature-tooltip'));

    // Then
    expect(await screen.findByText(/이번 달 \d+회 남았어요/)).toBeTruthy();
  });

  describe('이번 달 한도를 다 쓴 날', () => {
    // 고정 초기화 시각이 지난 스냅샷으로 보이지 않게 시계를 맞춘다
    setupFakeTimersPerTest({ now: new Date('2026-11-04T00:00:00.000Z'), advanceTimers: true });

    it('이번 달 AI를 다 쓴 칩을 누르면 막힌 순간과 같은 안내를 연다', async () => {
      // Given
      const httpClient = createHttpClientStub();
      httpClient.get.mockResolvedValue(
        ok(createEntitlementSnapshotDto({ used: { AI_PARSE: PLAN_CATALOG.AI_PARSE.free } })),
      );
      const analytics = createAnalyticsStub();
      await render(
        <GestureHandlerProvider>
          <FontScaleProvider>
            <HeroUIProvider
              config={{ animation: 'disable-all', devInfo: { stylingPrinciples: false } }}
            >
              <QueryClientProvider client={createTestQueryClient()}>
                <StaticDIProvider
                  container={createTestDi({
                    ports: { httpClient, analytics, logger: silentLogger },
                  })}
                >
                  <LocalDateProvider>
                    <OverlayProvider>
                      <QuickVoiceQuota />
                    </OverlayProvider>
                  </LocalDateProvider>
                </StaticDIProvider>
              </QueryClientProvider>
            </HeroUIProvider>
          </FontScaleProvider>
        </GestureHandlerProvider>,
      );

      // When
      await fireEvent.press(await screen.findByRole('button', { name: /이번 달 모두 사용/ }));

      // Then
      await waitFor(() =>
        expect(analytics.trackEvent).toHaveBeenCalledWith(
          'premium_gate_shown',
          expect.objectContaining({ feature: 'ai_parse', surface: 'add_todo_sheet' }),
        ),
      );
    });
  });
});
