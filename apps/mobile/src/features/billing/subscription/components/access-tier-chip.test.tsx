import '@src/shared/i18n/init';
import { ok } from '@src/core/errors/result';
import { createHttpClientStub } from '@src/shared/__tests__';
import { createTestDi } from '@src/shared/__tests__';
import { renderUi } from '@src/shared/__tests__/render-ui';
import { screen } from '@testing-library/react-native';
import { Suspense } from 'react';

import { createEntitlementSnapshotDto } from '../__tests__/entitlement.fixtures';
import { AccessTierChip } from './access-tier-chip';

describe('등급 칩', () => {
  it.each([
    ['FREE', '베이직'],
    ['PREMIUM', '프리미엄'],
    ['ADMIN', '어드민'],
  ] as const)('%s 사용자에게 서버가 정한 등급을 보여 준다', async (tier, label) => {
    // Given
    const httpClient = createHttpClientStub();
    httpClient.get.mockResolvedValue(ok(createEntitlementSnapshotDto({ tier })));

    // When
    await renderUi(
      <Suspense fallback={null}>
        <AccessTierChip />
      </Suspense>,
      { di: createTestDi({ httpClient }) },
    );

    // Then
    expect(await screen.findByText(label)).toBeTruthy();
  });
});
