import '@src/shared/i18n/init';
import { PLAN_CATALOG } from '@aido/api/vocabulary';
import { ok } from '@src/core/errors/result';
import { LocalDateProvider } from '@src/shared/providers/local-date-provider';
import { createHttpClientStub, createTestQueryClient } from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { screen } from '@testing-library/react-native';

import {
  createEntitlementSnapshot,
  createEntitlementSnapshotDto,
} from '../__tests__/entitlement.fixtures';
import { type EntitlementSnapshot } from '../domains/entitlement.model';
import { ENTITLEMENT_QUERY_KEYS } from '../queries/entitlement-query-keys';
import { QuotaSummary } from './quota-summary';

const AI_PARSE_FREE_LIMIT = PLAN_CATALOG.AI_PARSE.free;
const VOICE_NOTE_FREE_LIMIT = PLAN_CATALOG.VOICE_NOTE.free;

async function renderSummary(snapshot: EntitlementSnapshot) {
  const httpClient = createHttpClientStub();
  httpClient.get.mockResolvedValue(ok(createEntitlementSnapshotDto()));
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  queryClient.setQueryData(ENTITLEMENT_QUERY_KEYS.snapshot(), snapshot);

  return renderScreen(
    <LocalDateProvider>
      <QuotaSummary />
    </LocalDateProvider>,
    { di: { httpClient }, queryClient },
  );
}

describe('QuotaSummary', () => {
  beforeEach(() => {
    // 고정 초기화 시각이 지난 스냅샷으로 보이지 않게 시계를 맞춘다
    // oxlint-disable-next-line aido/test-spy-target -- 1.15.2 전환 #1400
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-11-04T00:00:00.000Z'));
  });

  it('쓴 횟수와 한도를 막대와 같은 기준(사용량)으로 보여 준다', async () => {
    // Given
    const snapshot = createEntitlementSnapshot({ used: { AI_PARSE: 3 } });

    // When
    await renderSummary(snapshot);

    // Then
    expect(screen.getByText('이번 달 AI 사용량')).toBeTruthy();
    expect(screen.getByText(`3 / ${AI_PARSE_FREE_LIMIT}회 사용`)).toBeTruthy();
    expect(screen.getByText(`0 / ${VOICE_NOTE_FREE_LIMIT}회 사용`)).toBeTruthy();
    expect(screen.queryByText(/초기화돼요/)).toBeNull();
  });

  it('다 쓴 항목에만 다시 생기는 날을 붙인다', async () => {
    // Given
    const snapshot = createEntitlementSnapshot({ used: { AI_PARSE: AI_PARSE_FREE_LIMIT } });

    // When
    await renderSummary(snapshot);

    // Then
    expect(screen.getByText(`${AI_PARSE_FREE_LIMIT} / ${AI_PARSE_FREE_LIMIT}회 사용`)).toBeTruthy();
    expect(screen.getAllByText(/초기화돼요/)).toHaveLength(1);
  });

  it('한도보다 많이 쓴 기록이 와도 한도를 넘는 숫자를 보여 주지 않는다', async () => {
    // Given
    const snapshot = createEntitlementSnapshot({ used: { AI_PARSE: AI_PARSE_FREE_LIMIT + 4 } });

    // When
    await renderSummary(snapshot);

    // Then
    expect(screen.getByText(`${AI_PARSE_FREE_LIMIT} / ${AI_PARSE_FREE_LIMIT}회 사용`)).toBeTruthy();
  });

  it.each(['PREMIUM', 'ADMIN'] as const)('%s에게는 카드를 그리지 않는다', async (tier) => {
    // Given
    const snapshot = createEntitlementSnapshot({ tier, used: { AI_PARSE: 3 } });

    // When
    await renderSummary(snapshot);

    // Then
    expect(screen.queryByTestId('quota-summary')).toBeNull();
  });
});
