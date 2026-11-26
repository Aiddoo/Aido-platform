import { ServerError } from '@src/shared/errors/infra-error';
import {
  createAnalyticsStub,
  createAppStoreListingGatewayStub,
  createErrorReporterStub,
  createJsonFetcherStub,
  createNativeApplicationMetadataGatewayStub,
  createTestDi,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { onlineManager } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { AppVersionCheck } from './app-version-check';

const ENABLED_RESPONSE = {
  enabled: true,
  ios: { latestVersion: '1.15.0' },
  android: { latestVersion: '1.15.0' },
};

async function renderCheck({
  jsonFetcher,
  currentVersion = '1.14.0',
  openListing = async () => {},
}: {
  jsonFetcher: ReturnType<typeof createJsonFetcherStub>;
  currentVersion?: string;
  openListing?: () => Promise<void>;
}) {
  const listing = createAppStoreListingGatewayStub();
  listing.openListing.mockImplementation(openListing);
  const errorReporter = createErrorReporterStub();
  const analytics = createAnalyticsStub();
  const view = await renderScreen(<AppVersionCheck />, {
    di: createTestDi({
      ports: {
        jsonFetcher,
        applicationMetadata: createNativeApplicationMetadataGatewayStub({
          platform: 'ios',
          currentVersion,
          currentBuild: null,
          applicationId: null,
        }),
        appStoreListing: listing,
        errorReporter,
        analytics,
      },
    }),
    withOverlay: true,
  });

  return { listing, errorReporter, analytics, unmount: view.unmount };
}

function countStoreOpenedEvents(analytics: ReturnType<typeof createAnalyticsStub>) {
  return analytics.trackEvent.mock.calls.filter(([name]) => name === 'app_update_store_opened');
}

describe('AppVersionCheck', () => {
  afterEach(() => {
    onlineManager.setOnline(true);
  });

  it('서버가 장애여도 앱을 막지 않고 확인하지 못했다고만 알린다', async () => {
    // Given
    const jsonFetcher = createJsonFetcherStub();
    jsonFetcher.get.mockRejectedValue(new ServerError(500));
    const { listing, errorReporter } = await renderCheck({ jsonFetcher });

    // When
    await fireEvent.press(screen.getByText('버전 정보'));

    // Then
    expect(await screen.findAllByText(/버전 정보를 확인하지 못했어요/)).not.toHaveLength(0);
    expect(errorReporter.captureException).toHaveBeenCalledTimes(1);
    expect(listing.openListing).not.toHaveBeenCalled();
    expect(screen.getByText('1.14.0')).toBeTruthy();
  });

  it('서버 점검이 꺼져 있으면 실패로 알리지 않고 안내할 새 버전이 없다고 알린다', async () => {
    // Given
    const jsonFetcher = createJsonFetcherStub();
    jsonFetcher.get.mockResolvedValue({ enabled: false });
    const { listing, errorReporter } = await renderCheck({ jsonFetcher });

    // When
    await fireEvent.press(screen.getByText('버전 정보'));

    // Then
    expect(await screen.findAllByText('지금은 안내할 새 버전이 없어요.')).not.toHaveLength(0);
    expect(screen.queryByText(/버전 정보를 확인하지 못했어요/)).toBeNull();
    expect(errorReporter.captureException).not.toHaveBeenCalled();
    expect(listing.openListing).not.toHaveBeenCalled();
  });

  it('연결이 없으면 요청 없이 바로 오프라인이라고 알리고 나중에 스토어를 열지 않는다', async () => {
    // Given
    onlineManager.setOnline(false);
    const jsonFetcher = createJsonFetcherStub();
    jsonFetcher.get.mockResolvedValue(ENABLED_RESPONSE);
    const { listing } = await renderCheck({ jsonFetcher });

    // When
    await fireEvent.press(screen.getByText('버전 정보'));
    onlineManager.setOnline(true);

    // Then
    expect(
      await screen.findAllByText(/인터넷에 연결되면 버전을 확인할 수 있어요/),
    ).not.toHaveLength(0);
    expect(jsonFetcher.get).not.toHaveBeenCalled();
    expect(listing.openListing).not.toHaveBeenCalled();
  });

  it('더 새 버전이 있으면 스토어를 연다', async () => {
    // Given
    const jsonFetcher = createJsonFetcherStub();
    jsonFetcher.get.mockResolvedValue(ENABLED_RESPONSE);
    const { listing } = await renderCheck({ jsonFetcher });

    // When
    await fireEvent.press(screen.getByText('버전 정보'));

    // Then
    await screen.findByText('1.14.0');
    expect(listing.openListing).toHaveBeenCalledTimes(1);
  });

  it('스토어를 열지 못하면 알리고 보고한다', async () => {
    // Given
    const jsonFetcher = createJsonFetcherStub();
    jsonFetcher.get.mockResolvedValue(ENABLED_RESPONSE);
    const { errorReporter } = await renderCheck({
      jsonFetcher,
      openListing: () => Promise.reject(new Error('스토어 없음')),
    });

    // When
    await fireEvent.press(screen.getByText('버전 정보'));

    // Then
    expect(await screen.findAllByText(/앱 스토어를 열지 못했어요/)).not.toHaveLength(0);
    expect(errorReporter.captureException).toHaveBeenCalledTimes(1);
  });

  it('더 새 버전이 있어 스토어를 열면 스토어 열기를 한 번 남긴다', async () => {
    // Given
    const jsonFetcher = createJsonFetcherStub();
    jsonFetcher.get.mockResolvedValue(ENABLED_RESPONSE);
    const { listing, analytics } = await renderCheck({ jsonFetcher });

    // When
    await fireEvent.press(screen.getByText('버전 정보'));

    // Then
    await waitFor(() => expect(listing.openListing).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(countStoreOpenedEvents(analytics)).toEqual([
        ['app_update_store_opened', { source: 'settings' }],
      ]),
    );
  });

  it.each([
    ['이미 최신이면', '1.15.0', '현재 최신 버전을 사용하고 있어요.'],
    ['설치 버전을 판정할 수 없으면', '1.14', /버전 정보를 확인하지 못했어요/],
  ])('%s 스토어를 열지 않고 스토어 열기도 남기지 않는다', async (_case, currentVersion, notice) => {
    // Given
    const jsonFetcher = createJsonFetcherStub();
    jsonFetcher.get.mockResolvedValue(ENABLED_RESPONSE);
    const { listing, analytics } = await renderCheck({ jsonFetcher, currentVersion });

    // When
    await fireEvent.press(screen.getByText('버전 정보'));

    // Then
    expect(await screen.findAllByText(notice)).not.toHaveLength(0);
    expect(listing.openListing).not.toHaveBeenCalled();
    expect(countStoreOpenedEvents(analytics)).toEqual([]);
  });

  it('스토어가 열리는 사이 화면이 내려가도 스토어 열기를 남긴다', async () => {
    // Given
    const jsonFetcher = createJsonFetcherStub();
    jsonFetcher.get.mockResolvedValue(ENABLED_RESPONSE);
    const opening = Promise.withResolvers<void>();
    const { listing, analytics, unmount } = await renderCheck({
      jsonFetcher,
      openListing: () => opening.promise,
    });
    await fireEvent.press(screen.getByText('버전 정보'));
    await waitFor(() => expect(listing.openListing).toHaveBeenCalledTimes(1));

    // When
    await unmount();
    await act(async () => {
      opening.resolve();
    });

    // Then
    expect(countStoreOpenedEvents(analytics)).toHaveLength(1);
  });

  it('이미 최신이면 스토어를 열지 않고 최신이라고 알린다', async () => {
    // Given
    const jsonFetcher = createJsonFetcherStub();
    jsonFetcher.get.mockResolvedValue(ENABLED_RESPONSE);
    const { listing } = await renderCheck({ jsonFetcher, currentVersion: '1.15.0' });

    // When
    await fireEvent.press(screen.getByText('버전 정보'));

    // Then
    expect(await screen.findByText('현재 최신 버전을 사용하고 있어요.')).toBeTruthy();
    expect(listing.openListing).not.toHaveBeenCalled();
  });
});
