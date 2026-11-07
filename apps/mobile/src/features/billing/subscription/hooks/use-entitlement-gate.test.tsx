import '@src/shared/i18n/init';
import type { AccessTier } from '@aido/api';
import { ErrorCode } from '@aido/api/errors';
import { PLAN_CATALOG } from '@aido/api/vocabulary';
import { ok } from '@src/core/errors/result';
import {
  createAnalyticsStub,
  createErrorReporterStub,
  createHttpClientStub,
  createTestDi,
} from '@src/shared/__tests__';
import { createTestQueryClient } from '@src/shared/__tests__/query-client';
import { renderUi } from '@src/shared/__tests__/render-ui';
import { LocalDateProvider } from '@src/shared/providers/local-date-provider';
import { Button } from '@src/shared/ui';
import { OverlayProvider } from '@src/shared/ui/overlay/overlay-provider';
import { fireEvent, screen } from '@testing-library/react-native';

import {
  createEntitlementSnapshot,
  createEntitlementSnapshotDto,
  createFeatureQuotaDto,
  createLimitApiError,
} from '../__tests__/entitlement.fixtures';
import { ENTITLEMENT_QUERY_KEYS } from '../constants/entitlement-query-keys';
import { EntitlementPolicy } from '../domains/entitlement.model';
import { type EntitlementSnapshot } from '../schemas/entitlement.schema';
import { useEntitlementGate } from './use-entitlement-gate';

const LIMIT_TITLE = '이번 달 AI 할 일 만들기를 다 썼어요';
function AiParseGate({ error }: { error?: unknown }) {
  const gate = useEntitlementGate('AI_PARSE', { surface: 'add_todo_sheet' });

  return (
    <>
      <Button onPress={() => gate.checkAccessOrPrompt()}>시작</Button>
      <Button onPress={() => gate.promptIfLimited(error)}>서버 응답</Button>
    </>
  );
}

async function renderGate(snapshot: EntitlementSnapshot, { error }: { error?: unknown } = {}) {
  const analytics = createAnalyticsStub();
  const httpClient = createHttpClientStub();
  httpClient.get.mockResolvedValue(ok(createEntitlementSnapshotDto()));
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  queryClient.setQueryData(ENTITLEMENT_QUERY_KEYS.snapshot(), snapshot);

  await renderUi(
    <LocalDateProvider>
      <OverlayProvider>
        <AiParseGate error={error} />
      </OverlayProvider>
    </LocalDateProvider>,
    {
      di: createTestDi({ httpClient, analytics, errorReporter: createErrorReporterStub() }),
      queryClient,
    },
  );

  return { analytics, queryClient };
}

describe('useEntitlementGate', () => {
  it.each([
    ['FREE', true],
    ['PREMIUM', false],
    ['ADMIN', false],
  ] as const satisfies readonly (readonly [AccessTier, boolean])[])(
    '무료 한도만큼 쓴 %s가 시작하면 한도 안내를 띄우는지: %s',
    async (tier, isDialogShown) => {
      // Given
      const { analytics } = await renderGate(
        createEntitlementSnapshot({ tier, used: { AI_PARSE: PLAN_CATALOG.AI_PARSE.free } }),
      );

      // When
      fireEvent.press(screen.getByText('시작'));

      // Then
      const shownEvents = analytics.trackEvent.mock.calls.map(([eventName]) => eventName);
      expect(shownEvents).toEqual(
        isDialogShown ? ['limit_reached_shown', 'premium_gate_shown'] : [],
      );
    },
  );

  it('남은 횟수가 0이면 시작 전에 PremiumDialog를 띄우고 precheck로 기록한다', async () => {
    // Given
    const { analytics } = await renderGate(
      createEntitlementSnapshot({ used: { AI_PARSE: PLAN_CATALOG.AI_PARSE.free } }),
    );

    // When
    fireEvent.press(screen.getByText('시작'));

    // Then
    expect(await screen.findByText(LIMIT_TITLE)).toBeTruthy();
    expect(screen.getByText('구독하기')).toBeTruthy();
    expect(analytics.trackEvent).toHaveBeenCalledWith('limit_reached_shown', {
      feature: 'ai_parse',
      surface: 'add_todo_sheet',
      trigger: 'precheck',
    });
    expect(analytics.trackEvent).toHaveBeenCalledWith('premium_gate_shown', {
      feature: 'ai_parse',
      surface: 'add_todo_sheet',
    });
  });

  it('서버가 AI_1303으로 막으면 같은 다이얼로그를 띄우고 받은 한도로 스냅샷을 바꾼다', async () => {
    // Given
    const featureQuota = createFeatureQuotaDto('AI_PARSE', { used: PLAN_CATALOG.AI_PARSE.free });
    const error = createLimitApiError(ErrorCode.AI_1303, { charged: false, featureQuota });
    const { analytics, queryClient } = await renderGate(
      createEntitlementSnapshot({ used: { AI_PARSE: 2 } }),
      { error },
    );

    // When
    fireEvent.press(screen.getByText('서버 응답'));

    // Then
    expect(await screen.findByText(LIMIT_TITLE)).toBeTruthy();
    const snapshot = queryClient.getQueryData<EntitlementSnapshot>(
      ENTITLEMENT_QUERY_KEYS.snapshot(),
    );
    expect(snapshot && EntitlementPolicy.getRemainingCount(snapshot, 'AI_PARSE')).toBe(0);
    expect(analytics.trackEvent).toHaveBeenCalledWith('limit_reached_shown', {
      feature: 'ai_parse',
      surface: 'add_todo_sheet',
      trigger: 'server',
    });
  });

  it('한도가 아닌 오류는 부른 쪽에 맡긴다', async () => {
    // Given
    const error = createLimitApiError(ErrorCode.AI_1302, undefined, 422);
    const { analytics } = await renderGate(createEntitlementSnapshot(), { error });

    // When
    fireEvent.press(screen.getByText('서버 응답'));

    // Then
    expect(screen.queryByText(LIMIT_TITLE)).toBeNull();
    expect(analytics.trackEvent).not.toHaveBeenCalled();
  });
});
