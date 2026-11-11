import '@src/shared/i18n/init';
import { PLAN_CATALOG } from '@aido/api/vocabulary';
import { ok } from '@src/core/errors/result';
import { createHttpClientStub, createTestQueryClient, renderUi } from '@src/shared/__tests__';
import { screen } from '@testing-library/react-native';

import {
  createEntitlementSnapshot,
  createEntitlementSnapshotDto,
} from '../__tests__/entitlement.fixtures';
import { type EntitlementFeature, type EntitlementSnapshot } from '../domains/entitlement.model';
import { ENTITLEMENT_QUERY_KEYS } from '../queries/entitlement-query-keys';
import { QuotaChip } from './quota-chip';

async function renderChip(snapshot: EntitlementSnapshot, feature: EntitlementFeature) {
  const httpClient = createHttpClientStub();
  httpClient.get.mockResolvedValue(ok(createEntitlementSnapshotDto()));
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  queryClient.setQueryData(ENTITLEMENT_QUERY_KEYS.snapshot(), snapshot);

  return renderUi(<QuotaChip feature={feature} />, {
    di: { httpClient },
    queryClient,
  });
}

describe('QuotaChip', () => {
  beforeEach(() => {
    // 고정 초기화 시각이 지난 스냅샷으로 보이지 않게 시계를 맞춘다
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-11-04T00:00:00.000Z'));
  });

  it('무료 사용자에게 이번 달 남은 횟수를 보여 준다', async () => {
    // Given
    const snapshot = createEntitlementSnapshot({ used: { AI_PARSE: 3 } });

    // When
    await renderChip(snapshot, 'AI_PARSE');

    // Then
    expect(screen.getByText('7회 남음')).toBeTruthy();
  });

  it.each([
    ['AI_PARSE', PLAN_CATALOG.AI_PARSE.free, '이번 달 모두 사용'],
    ['NUDGE', PLAN_CATALOG.NUDGE.free, '오늘 모두 사용'],
  ] as const)('%s를 다 쓰면 기간에 맞춰 다 썼다고 보여 준다', async (feature, used, label) => {
    // Given
    const snapshot = createEntitlementSnapshot({ used: { [feature]: used } });

    // When
    await renderChip(snapshot, feature);

    // Then
    expect(screen.getByText(label)).toBeTruthy();
  });

  it.each(['PREMIUM', 'ADMIN'] as const)('%s에게는 알약을 그리지 않는다', async (tier) => {
    // Given
    const snapshot = createEntitlementSnapshot({ tier, used: { AI_PARSE: 3 } });

    // When
    await renderChip(snapshot, 'AI_PARSE');

    // Then
    expect(screen.queryByText(/남음|모두 사용/)).toBeNull();
  });
});
