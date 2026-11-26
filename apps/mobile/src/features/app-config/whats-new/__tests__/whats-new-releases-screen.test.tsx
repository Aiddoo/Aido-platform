import '@src/shared/i18n/init';
import { createAuthSessionStoreStub } from '@src/features/identity/auth/__tests__/create-auth-session-store-stub';
import { createUser } from '@src/features/identity/user/__tests__/user.fixtures';
import { USER_QUERY_KEYS } from '@src/features/identity/user/queries/user-query-keys';
import { toInstant } from '@src/shared/date/instant';
import {
  createAnalyticsStub,
  createExternalLinkGatewayStub,
  createJsonFetcherStub,
  createTestDi,
  createTestQueryClient,
  getTrackedEvents,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import WhatsNewReleasesScreen from '../../../../../app/(app)/(tabs)/(me,memos,todos)/whats-new/releases';
import { RELEASE_1_15_0, RELEASE_1_16_0, RELEASE_1_17_0 } from '../constants/releases.constants';

const ACCOUNT_ID = 'user-1';
const CAMPAIGN_CONFIG = {
  enabled: true,
  campaignId: RELEASE_1_17_0.campaignId,
  minAppVersion: '1.15.0',
  launchedAt: '2026-11-10T00:00:00.000Z',
  autoOpen: true,
};

async function renderReleases({ hasSeenCampaign = false } = {}) {
  const jsonFetcher = createJsonFetcherStub();
  jsonFetcher.get.mockResolvedValue(CAMPAIGN_CONFIG);
  const analytics = createAnalyticsStub();
  const externalLink = createExternalLinkGatewayStub();
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  queryClient.setQueryData(
    USER_QUERY_KEYS.me(),
    createUser({ id: ACCOUNT_ID, createdAt: toInstant('2026-11-01T00:00:00.000Z') }),
  );
  const di = createTestDi({
    ports: { jsonFetcher, analytics, externalLink, queryClient },
    seeds: { authSessionStore: createAuthSessionStoreStub('authenticated') },
  });
  if (hasSeenCampaign) {
    di.whatsNewRepository.claimSeen(
      { userId: ACCOUNT_ID, campaignId: RELEASE_1_17_0.campaignId },
      toInstant('2026-11-24T00:00:00.000Z'),
    );
  }
  await renderScreen(<WhatsNewReleasesScreen />, { di, withLocalDate: true });

  return { analytics, externalLink, jsonFetcher };
}

describe('WhatsNewReleasesScreen', () => {
  beforeEach(() => {
    jest.mocked(router.push).mockClear();
  });

  it('소개가 있는 출시를 누르면 목록에서 연 소개를 연다', async () => {
    // Given
    await renderReleases();

    // When
    await fireEvent.press(screen.getByTestId(`whats-new-release-${RELEASE_1_16_0.id}`));

    // Then
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/whats-new',
      params: { releaseId: RELEASE_1_16_0.id, source: 'mypage' },
    });
  });

  it('소개를 뺀 지난 출시를 누르면 그 기능 화면으로 바로 가고 누름을 한 번 남긴다', async () => {
    // Given
    const { analytics } = await renderReleases();

    // When
    await fireEvent.press(screen.getByTestId(`whats-new-release-${RELEASE_1_15_0.id}`));

    // Then
    expect(router.push).toHaveBeenCalledWith(RELEASE_1_15_0.cta.href);
    expect(getTrackedEvents(analytics, 'whats_new_cta_pressed')).toEqual([
      { release_id: RELEASE_1_15_0.id, step: 'list' },
    ]);
  });

  it('서버가 켠 캠페인의 출시를 아직 보지 않았으면 그 줄에만 새 기능 표시를 단다', async () => {
    // When
    const { jsonFetcher } = await renderReleases();

    // Then
    await waitFor(() => expect(jsonFetcher.get).toHaveBeenCalledTimes(1));
    expect(
      await screen.findByLabelText(/캘린더 일정, 아이두로 쉽게 옮겨보세요.*아직 보지 않음$/),
    ).toBeOnTheScreen();
    expect(screen.getAllByText('새 기능')).toHaveLength(1);
  });

  it('캠페인을 이미 본 계정에는 새 기능 표시를 달지 않는다', async () => {
    // Given
    const { jsonFetcher } = await renderReleases({ hasSeenCampaign: true });

    // When
    await waitFor(() => expect(jsonFetcher.get).toHaveBeenCalledTimes(1));

    // Then
    expect(screen.queryByText('새 기능')).toBeNull();
  });

  it('전체 업데이트 내역은 앱 안 브라우저로 패치 노트를 연다', async () => {
    // Given
    const { externalLink } = await renderReleases();

    // When
    await fireEvent.press(screen.getByTestId('whats-new-patch-notes'));

    // Then
    expect(externalLink.openInAppBrowser).toHaveBeenCalledWith('https://aido.kr/ko/patch-notes');
  });
});
