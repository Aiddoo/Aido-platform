import '@src/shared/i18n/init';
import type { AccessTier } from '@aido/api';
import { ErrorCode } from '@aido/api/errors';
import { PLAN_CATALOG } from '@aido/api/vocabulary';
import { ok } from '@src/core/errors/result';
import { createUser } from '@src/features/identity/user/__tests__/user.fixtures';
import { USER_QUERY_KEYS } from '@src/features/identity/user/constants/user-query-keys';
import {
  createAnalyticsStub,
  createErrorReporterStub,
  createHttpClientStub,
  createMemoryObservableSyncStorage,
  createTestQueryClient,
  renderUi,
} from '@src/shared/__tests__';
import { LocalDateProvider } from '@src/shared/providers/local-date-provider';
import { readStoredValue } from '@src/shared/storage/define-stored-value';
import { Button } from '@src/shared/ui';
import { OverlayProvider } from '@src/shared/ui/overlay/overlay-provider';
import { screen, userEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import {
  createEntitlementSnapshot,
  createEntitlementSnapshotDto,
  createFeatureQuotaDto,
  createLimitApiError,
} from '../__tests__/entitlement.fixtures';
import { ENTITLEMENT_QUERY_KEYS } from '../constants/entitlement-query-keys';
import { type EntitlementSnapshot } from '../domains/entitlement.model';
import { EntitlementPolicy } from '../domains/entitlement.model';
import { upsellDismissalStoredValue } from '../schemas/upsell-dismissal-storage.schema';
import { useEntitlementGate } from './use-entitlement-gate';

const LIMIT_TITLE = '이번 달 AI 할 일 만들기를 다 썼어요';
const ALTERNATIVE_LABEL = '지금까지 정리하기';
const ACCOUNT_ID = 'account-1';
const USED_UP = { used: { AI_PARSE: PLAN_CATALOG.AI_PARSE.free } };

function AiParseGate({ error, onAlternative }: { error?: unknown; onAlternative: () => void }) {
  const gate = useEntitlementGate('AI_PARSE', { surface: 'add_todo_sheet' });

  return (
    <>
      <Button onPress={() => gate.promptIfBlocked()}>시작</Button>
      <Button
        onPress={() =>
          gate.promptIfBlocked({
            alternativeAction: { label: ALTERNATIVE_LABEL, onPress: onAlternative },
          })
        }
      >
        대안과 함께 시작
      </Button>
      <Button onPress={() => gate.promptIfBlockedError(error)}>서버 응답</Button>
    </>
  );
}

async function renderGate(snapshot: EntitlementSnapshot, { error }: { error?: unknown } = {}) {
  const analytics = createAnalyticsStub();
  const httpClient = createHttpClientStub();
  httpClient.get.mockResolvedValue(ok(createEntitlementSnapshotDto()));
  const syncStorage = createMemoryObservableSyncStorage();
  const onAlternative = jest.fn();
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  queryClient.setQueryData(ENTITLEMENT_QUERY_KEYS.snapshot(), snapshot);
  queryClient.setQueryData(USER_QUERY_KEYS.me(), createUser({ id: ACCOUNT_ID }));

  await renderUi(
    <LocalDateProvider>
      <OverlayProvider>
        <AiParseGate error={error} onAlternative={onAlternative} />
      </OverlayProvider>
    </LocalDateProvider>,
    {
      di: { httpClient, analytics, errorReporter: createErrorReporterStub(), syncStorage },
      queryClient,
    },
  );

  return {
    analytics,
    queryClient,
    onAlternative,
    readDismissals: () => readStoredValue(syncStorage, upsellDismissalStoredValue, ACCOUNT_ID),
    countEvents: (eventName: string) =>
      analytics.trackEvent.mock.calls.filter(([name]) => name === eventName).length,
  };
}

describe('useEntitlementGate', () => {
  it.each([
    ['FREE', true],
    ['PREMIUM', false],
    ['ADMIN', false],
  ] as const satisfies readonly (readonly [AccessTier, boolean])[])(
    '무료 한도만큼 쓴 %s가 시작하면 프리미엄 안내를 띄우는지: %s',
    async (tier, isPromptShown) => {
      // Given
      const user = userEvent.setup();
      const { analytics } = await renderGate(createEntitlementSnapshot({ tier, ...USED_UP }));

      // When
      await user.press(screen.getByRole('button', { name: '시작' }));

      // Then
      const shownEvents = analytics.trackEvent.mock.calls.map(([eventName]) => eventName);
      expect(shownEvents).toEqual(
        isPromptShown ? ['limit_reached_shown', 'premium_gate_shown'] : [],
      );
    },
  );

  it('남은 횟수가 0이면 시작 전에 막힌 기능 시트를 띄우고 precheck로 한 번 기록한다', async () => {
    // Given
    const user = userEvent.setup();
    const { analytics, countEvents } = await renderGate(createEntitlementSnapshot(USED_UP));

    // When
    await user.press(screen.getByRole('button', { name: '시작' }));

    // Then
    expect(await screen.findByText(LIMIT_TITLE)).toBeTruthy();
    expect(screen.getByRole('button', { name: '프리미엄 보기' })).toBeTruthy();
    expect(analytics.trackEvent).toHaveBeenCalledWith('limit_reached_shown', {
      feature: 'ai_parse',
      surface: 'add_todo_sheet',
      trigger: 'precheck',
    });
    expect(analytics.trackEvent).toHaveBeenCalledWith('premium_gate_shown', {
      feature: 'ai_parse',
      surface: 'add_todo_sheet',
      presentation: 'sheet',
    });
    expect(countEvents('premium_gate_shown')).toBe(1);
  });

  it('프리미엄 보기를 두 번 눌러도 막힌 기능을 실은 페이월로 한 번만 간다', async () => {
    // Given
    const user = userEvent.setup();
    const { countEvents } = await renderGate(createEntitlementSnapshot(USED_UP));
    await user.press(screen.getByRole('button', { name: '시작' }));
    const cta = await screen.findByRole('button', { name: '프리미엄 보기' });

    // When
    await user.press(cta);
    await user.press(cta);

    // Then
    await waitFor(() => expect(router.navigate).toHaveBeenCalledTimes(1));
    expect(router.navigate).toHaveBeenCalledWith({
      pathname: '/paywall',
      params: { feature: 'AI_PARSE' },
    });
    expect(countEvents('premium_gate_cta_tapped')).toBe(1);
    expect(countEvents('limit_reached_cta_tapped')).toBe(1);
    expect(countEvents('premium_upsell_dismissed')).toBe(0);
  });

  it('나중에를 누르면 오늘 닫은 것으로 남기고 같은 날 다시 막히면 토스트로만 알린다', async () => {
    // Given
    const user = userEvent.setup();
    const { analytics, countEvents, readDismissals } = await renderGate(
      createEntitlementSnapshot(USED_UP),
    );
    await user.press(screen.getByRole('button', { name: '시작' }));
    await user.press(await screen.findByRole('button', { name: '나중에' }));
    await waitFor(() => expect(countEvents('premium_upsell_dismissed')).toBe(1));

    // When
    await user.press(screen.getByRole('button', { name: '시작' }));

    // Then
    expect(readDismissals().AI_PARSE).toBeDefined();
    expect(analytics.trackEvent).toHaveBeenLastCalledWith('premium_gate_shown', {
      feature: 'ai_parse',
      surface: 'add_todo_sheet',
      presentation: 'toast',
    });
    // HeroUI 토스트가 같은 내용을 누를 수 없는 한 벌로 더 그려 첫 번째를 누른다
    const [toastAction] = await screen.findAllByRole('button', { name: '프리미엄 보기' });
    expect(screen.queryByRole('button', { name: '나중에' })).toBeNull();
    expect(toastAction).toBeDefined();
    if (toastAction != null) {
      await user.press(toastAction);
    }
    expect(router.navigate).toHaveBeenCalledWith({
      pathname: '/paywall',
      params: { feature: 'AI_PARSE' },
    });
    expect(analytics.trackEvent).toHaveBeenCalledWith('premium_gate_cta_tapped', {
      feature: 'ai_parse',
      surface: 'add_todo_sheet',
      presentation: 'toast',
    });
    expect(countEvents('premium_upsell_dismissed')).toBe(1);
  });

  it('무료 대안이 있으면 오늘 닫았어도 대안을 주 버튼으로 둔 시트를 띄운다', async () => {
    // Given
    const user = userEvent.setup();
    const { onAlternative, countEvents } = await renderGate(createEntitlementSnapshot(USED_UP));
    await user.press(screen.getByRole('button', { name: '시작' }));
    await user.press(await screen.findByRole('button', { name: '나중에' }));
    await waitFor(() => expect(countEvents('premium_upsell_dismissed')).toBe(1));

    // When
    await user.press(screen.getByRole('button', { name: '대안과 함께 시작' }));
    await user.press(await screen.findByRole('button', { name: ALTERNATIVE_LABEL }));

    // Then
    await waitFor(() => expect(onAlternative).toHaveBeenCalledTimes(1));
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('서버가 AI_1303으로 막으면 같은 시트를 띄우고 받은 한도로 스냅샷을 바꾼다', async () => {
    // Given
    const user = userEvent.setup();
    const featureQuota = createFeatureQuotaDto('AI_PARSE', { used: PLAN_CATALOG.AI_PARSE.free });
    const error = createLimitApiError(ErrorCode.AI_1303, { charged: false, featureQuota });
    const { analytics, queryClient } = await renderGate(
      createEntitlementSnapshot({ used: { AI_PARSE: 2 } }),
      { error },
    );

    // When
    await user.press(screen.getByRole('button', { name: '서버 응답' }));

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
    const user = userEvent.setup();
    const error = createLimitApiError(ErrorCode.AI_1302, undefined, 422);
    const { analytics } = await renderGate(createEntitlementSnapshot(), { error });

    // When
    await user.press(screen.getByRole('button', { name: '서버 응답' }));

    // Then
    expect(screen.queryByText(LIMIT_TITLE)).toBeNull();
    expect(analytics.trackEvent).not.toHaveBeenCalled();
  });
});
