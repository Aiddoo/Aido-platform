import '@src/shared/i18n/init';
import { PLAN_CATALOG } from '@aido/api/vocabulary';
import { createHttpClientStub } from '@src/shared/__tests__';
import { createTestQueryClient } from '@src/shared/__tests__/query-client';
import { renderUi } from '@src/shared/__tests__/render-ui';
import { ok } from '@src/shared/errors/result';
import { screen } from '@testing-library/react-native';

import {
  createEntitlementSnapshot,
  createEntitlementSnapshotDto,
} from '../__tests__/entitlement.fixtures';
import { EntitlementService } from '../apis/entitlement.service';
import { ENTITLEMENT_QUERY_KEYS } from '../constants/entitlement-query-keys';
import type { EntitlementFeature, EntitlementSnapshot } from '../schemas/entitlement.schema';
import { QuotaChip } from './quota-chip';

const silentLogger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

async function renderChip(snapshot: EntitlementSnapshot, feature: EntitlementFeature) {
  const httpClient = createHttpClientStub();
  httpClient.get.mockResolvedValue(ok(createEntitlementSnapshotDto()));
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  queryClient.setQueryData(ENTITLEMENT_QUERY_KEYS.snapshot(), snapshot);

  return renderUi(<QuotaChip feature={feature} />, {
    di: { entitlementService: new EntitlementService(httpClient, silentLogger) },
    queryClient,
  });
}

describe('QuotaChip', () => {
  it('무료 사용자에게 이번 달 남은 횟수를 보여 준다', async () => {
    // Given
    const snapshot = createEntitlementSnapshot({ used: { AI_PARSE: 3 } });

    // When
    await renderChip(snapshot, 'AI_PARSE');

    // Then
    expect(screen.getByText('7번 남음')).toBeTruthy();
  });

  it.each([
    ['AI_PARSE', PLAN_CATALOG.AI_PARSE.free, '이번 달 다 씀'],
    ['NUDGE', PLAN_CATALOG.NUDGE.free, '오늘 다 씀'],
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
    expect(screen.queryByText(/남음|다 씀/)).toBeNull();
  });
});
