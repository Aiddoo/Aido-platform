import '@src/shared/i18n/init';
import { ok } from '@src/core/errors/result';
import { emitTodoCompletionChanged } from '@src/core/events/todo-completion-changed';
import { createConsent } from '@src/features/identity/consent/__tests__/consent.fixtures';
import { CONSENT_QUERY_KEYS } from '@src/features/identity/consent/constants/consent-query-keys';
import { createPreferenceDto } from '@src/features/identity/preference/__tests__/preference.fixtures';
import { createUser } from '@src/features/identity/user/__tests__/user.fixtures';
import { USER_QUERY_KEYS } from '@src/features/identity/user/constants/user-query-keys';
import {
  createAnalyticsStub,
  createHttpClientStub,
  createTestQueryClient,
  renderUi,
} from '@src/shared/__tests__';
import { LocalDateProvider } from '@src/shared/providers/local-date-provider';
import { OverlayProvider } from '@src/shared/ui/overlay/overlay-provider';
import { act } from '@testing-library/react-native';

import { NOTIFICATION_QUERY_KEYS } from '../constants/notification-query-keys';
import { useOfferMarketingPushAfterCompletion } from './use-offer-marketing-push';

const OFFER_DELAY_MS = 700;

function OfferProbe() {
  useOfferMarketingPushAfterCompletion();
  return null;
}

async function renderOffer() {
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  queryClient.setQueryData(USER_QUERY_KEYS.me(), createUser());
  queryClient.setQueryData(
    CONSENT_QUERY_KEYS.detail(),
    createConsent({ marketingPushAgreedAt: null }),
  );
  queryClient.setQueryData(NOTIFICATION_QUERY_KEYS.permission(), {
    status: 'GRANTED',
    canAskAgain: false,
  });
  const httpClient = createHttpClientStub();
  httpClient.get.mockResolvedValue(ok(createPreferenceDto({ pushEnabled: true })));
  const analytics = createAnalyticsStub();
  // 앱처럼 Overlay 호스트를 LocalDateProvider 안에 둔다(제안 시트가 날짜 형식을 쓴다)
  await renderUi(
    <LocalDateProvider>
      <OverlayProvider>
        <OfferProbe />
      </OverlayProvider>
    </LocalDateProvider>,
    { queryClient, di: { httpClient, analytics } },
  );
  return { analytics, httpClient };
}

describe('useOfferMarketingPushAfterCompletion', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('설정 화면을 열지 않아 알림 설정이 캐시에 없어도 받아 와서 제안한다', async () => {
    // Given
    const { analytics, httpClient } = await renderOffer();

    // When
    await act(async () => {
      emitTodoCompletionChanged({ isCompleted: true });
      await jest.advanceTimersByTimeAsync(OFFER_DELAY_MS);
    });

    // Then
    expect(httpClient.get).toHaveBeenCalledWith('v1/auth/preference', expect.anything());
    expect(analytics.trackEvent).toHaveBeenCalledWith('marketing_push_prompt_shown', {
      source: 'completion_sheet',
    });
  });

  it('완료를 취소한 변경에는 제안하지 않는다', async () => {
    // Given
    const { analytics } = await renderOffer();

    // When
    await act(async () => {
      emitTodoCompletionChanged({ isCompleted: false });
      await jest.advanceTimersByTimeAsync(OFFER_DELAY_MS);
    });

    // Then
    expect(analytics.trackEvent).not.toHaveBeenCalledWith(
      'marketing_push_prompt_shown',
      expect.anything(),
    );
  });
});
