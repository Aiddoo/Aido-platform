import '@src/shared/i18n/init';
import type { AccessTier } from '@aido/api/vocabulary';
import { createCurrentUserDto } from '@src/features/identity/user/__tests__/user.fixtures';
import { toUser } from '@src/features/identity/user/apis/user.mapper';
import { MyPageMenuNavigationProvider } from '@src/features/identity/user/hooks/use-my-page-menu-navigation';
import { USER_QUERY_KEYS } from '@src/features/identity/user/queries/user-query-keys';
import { createTestQueryClient } from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { screen } from '@testing-library/react-native';
import { Suspense } from 'react';

import { createEntitlementSnapshot } from '../__tests__/entitlement.fixtures';
import { ENTITLEMENT_QUERY_KEYS } from '../queries/entitlement-query-keys';
import { PlanSummary } from './plan-summary';

const DAY_MS = 24 * 60 * 60 * 1000;

async function renderPlanSummary(tier: AccessTier) {
  const renewsAt = new Date(Date.now() + 30 * DAY_MS).toISOString();
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  queryClient.setQueryData(ENTITLEMENT_QUERY_KEYS.snapshot(), createEntitlementSnapshot({ tier }));
  queryClient.setQueryData(
    USER_QUERY_KEYS.me(),
    toUser(
      tier === 'FREE'
        ? createCurrentUserDto({ subscriptionStatus: 'FREE' })
        : createCurrentUserDto({
            subscriptionStatus: 'ACTIVE',
            isPremium: true,
            premiumSource: 'STORE',
            premiumEndsAt: renewsAt,
            premiumPeriodEndsAt: renewsAt,
            willRenew: true,
            bankedPremiumDays: 14,
            premiumGrantEndedAt: null,
            premiumPlanType: 'ANNUAL',
          }),
    ),
  );

  await renderScreen(
    <MyPageMenuNavigationProvider>
      <Suspense fallback={null}>
        <PlanSummary />
      </Suspense>
    </MyPageMenuNavigationProvider>,
    { queryClient, withLocalDate: true },
  );
}

describe('PlanSummary', () => {
  it('무료 사용자는 이번 달 사용량과 프리미엄 보기를 본다', async () => {
    // When
    await renderPlanSummary('FREE');

    // Then
    expect(await screen.findByTestId('quota-summary')).toBeTruthy();
    expect(screen.getByTestId('plan-summary-see-premium')).toBeTruthy();
    expect(screen.queryByTestId('plan-summary-premium')).toBeNull();
  });

  it('연간 구독 중이면 요금제·다음 결제일과 구독 뒤 이어질 보상을 영수증 규칙대로 보인다', async () => {
    // When
    await renderPlanSummary('PREMIUM');

    // Then
    expect(await screen.findByTestId('plan-summary-premium')).toBeTruthy();
    expect(screen.getByText('연간 구독 이용 중')).toBeTruthy();
    expect(screen.getByText(/에 다음 결제$/)).toBeTruthy();
    expect(screen.getByText('구독이 끝나면 보상 14일이 이어서 시작돼요')).toBeTruthy();
    expect(screen.queryByTestId('quota-summary')).toBeNull();
  });
});
