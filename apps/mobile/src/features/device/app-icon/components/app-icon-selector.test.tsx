import { createEntitlementSnapshot } from '@src/features/billing/subscription/__tests__/entitlement.fixtures';
import type { EntitlementSnapshot } from '@src/features/billing/subscription/domains/entitlement.model';
import { ENTITLEMENT_QUERY_KEYS } from '@src/features/billing/subscription/queries/entitlement-query-keys';
import { createUser } from '@src/features/identity/user/__tests__/user.fixtures';
import { USER_QUERY_KEYS } from '@src/features/identity/user/queries/user-query-keys';
import {
  createAnalyticsStub,
  createAppIconGatewayStub,
  createErrorReporterStub,
  createTestQueryClient,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { screen, userEvent, waitFor } from '@testing-library/react-native';
import { Suspense } from 'react';

import type { AppIconKey } from '../domains/app-icon.model';
import { APP_ICON_QUERY_KEYS } from '../queries/app-icon-query-keys';
import { AppIconSelector } from './app-icon-selector';

const PREMIUM_GATE_TITLE = '앱 아이콘 변경은 프리미엄 기능이에요';

async function renderSelector(snapshot: EntitlementSnapshot, currentIcon: AppIconKey = 'default') {
  const gateway = createAppIconGatewayStub();
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  queryClient.setQueryData(APP_ICON_QUERY_KEYS.current(), currentIcon);
  queryClient.setQueryData(ENTITLEMENT_QUERY_KEYS.snapshot(), snapshot);
  queryClient.setQueryData(USER_QUERY_KEYS.me(), createUser());

  await renderScreen(
    <Suspense>
      <AppIconSelector />
    </Suspense>,
    {
      queryClient,
      withLocalDate: true,
      withOverlay: true,
      di: {
        appIcon: gateway,
        analytics: createAnalyticsStub(),
        errorReporter: createErrorReporterStub(),
      },
    },
  );

  return { gateway };
}

describe('앱 아이콘 고르기', () => {
  it('무료 사용자가 고양이 아이콘을 고르면 프리미엄 안내를 띄우고 아이콘은 그대로 둔다', async () => {
    // Given
    const user = userEvent.setup();
    const { gateway } = await renderSelector(createEntitlementSnapshot({ tier: 'FREE' }));

    // When
    await user.press(screen.getByRole('radio', { name: '턱시도 고양이' }));

    // Then
    expect(await screen.findByText(PREMIUM_GATE_TITLE)).toBeTruthy();
    expect(gateway.changeIcon).not.toHaveBeenCalled();
    expect(screen.getByRole('radio', { name: '기본' })).toBeChecked();
  });

  it('프리미엄 사용자가 고양이 아이콘을 고르면 아이콘을 바꾸고 고른 아이콘이 선택된다', async () => {
    // Given
    const user = userEvent.setup();
    const { gateway } = await renderSelector(createEntitlementSnapshot({ tier: 'PREMIUM' }));

    // When
    await user.press(screen.getByRole('radio', { name: '턱시도 고양이' }));

    // Then
    await waitFor(() => expect(screen.getByRole('radio', { name: '턱시도 고양이' })).toBeChecked());
    expect(gateway.changeIcon).toHaveBeenCalledWith('tuxedo_cat');
    expect(screen.queryByText(PREMIUM_GATE_TITLE)).toBeNull();
  });

  it('구독이 끝나 고양이 아이콘이 남은 무료 사용자도 안내 없이 기본 아이콘으로 되돌린다', async () => {
    // Given
    const user = userEvent.setup();
    const { gateway } = await renderSelector(
      createEntitlementSnapshot({ tier: 'FREE' }),
      'cream_cat',
    );

    // When
    await user.press(screen.getByRole('radio', { name: '기본' }));

    // Then
    await waitFor(() => expect(screen.getByRole('radio', { name: '기본' })).toBeChecked());
    expect(gateway.changeIcon).toHaveBeenCalledWith(null);
    expect(screen.queryByText(PREMIUM_GATE_TITLE)).toBeNull();
  });
});
