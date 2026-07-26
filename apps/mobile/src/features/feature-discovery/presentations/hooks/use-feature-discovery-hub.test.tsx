import { getBundledFeatureDiscoveryCampaign } from '@src/features/feature-discovery/models/feature-discovery.registry';
import { act, fireEvent, render, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { FEATURE_DISCOVERY_CAMPAIGN_ID } from '../../models/feature-discovery.registry';
import { useFeatureDiscoveryHub } from './use-feature-discovery-hub';

const mockTrackEvent = jest.fn();
const mockClose = jest.fn();
const mockExit = jest.fn();
const mockPush = jest.fn();
const mockFeatureAttribution = {
  record: jest.fn(),
  consume: jest.fn(),
};
let renderedOverlay: ReactNode = null;

const mockOverlayOpen = jest.fn(
  (
    renderOverlay: (controls: {
      isOpen: boolean;
      close: () => void;
      exit: () => void;
    }) => ReactNode,
  ) => {
    renderedOverlay = renderOverlay({
      isOpen: true,
      close: mockClose,
      exit: mockExit,
    });
    return Promise.resolve();
  },
);

jest.mock('@src/bootstrap/providers/di-context', () => ({
  useAnalytics: () => ({
    trackEvent: mockTrackEvent,
    setUserId: jest.fn(),
    setUserProperties: jest.fn(),
    logScreenView: jest.fn(),
  }),
  useFeatureAttribution: () => mockFeatureAttribution,
}));

jest.mock('@src/shared/ui', () => ({
  useOverlay: () => ({ open: mockOverlayOpen }),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('../components/FeatureDiscoverySheet', () => ({
  FeatureDiscoverySheet: ({ onCardCta }: { onCardCta: (cardId: 'memo_ai') => void }) => {
    const React = require('react');
    const { Pressable, Text } = require('react-native');
    return React.createElement(
      Pressable,
      {
        accessibilityRole: 'button',
        onPress: () => onCardCta('memo_ai'),
      },
      React.createElement(Text, null, '메모 기능으로 이동'),
    );
  },
}));

const campaign = getBundledFeatureDiscoveryCampaign(FEATURE_DISCOVERY_CAMPAIGN_ID);

describe('useFeatureDiscoveryHub', () => {
  beforeEach(() => {
    renderedOverlay = null;
    mockTrackEvent.mockReset();
    mockClose.mockReset();
    mockExit.mockReset();
    mockPush.mockReset();
    mockOverlayOpen.mockClear();
    mockFeatureAttribution.record.mockReset();
    mockFeatureAttribution.consume.mockReset();
  });

  it('귀속 저장 실패에도 허브를 닫고 카드 화면으로 이동한다', async () => {
    // Given
    if (!campaign) {
      throw new Error('bundled campaign missing');
    }
    mockFeatureAttribution.record.mockImplementation(() => {
      throw new Error('MMKV unavailable');
    });
    const { result } = await renderHook(() => useFeatureDiscoveryHub());
    await act(async () => {
      result.current.openHub({
        accountId: 'user-1',
        campaign,
        source: 'mypage',
      });
    });
    if (!renderedOverlay) {
      throw new Error('overlay was not rendered');
    }
    const overlay = await render(<View>{renderedOverlay}</View>);

    // When
    await fireEvent.press(overlay.getByText('메모 기능으로 이동'));

    // Then
    expect(mockClose).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/memo/create');
  });

  it('분석 전송 실패에도 허브를 열고 CTA에서 닫기와 이동을 계속한다', async () => {
    // Given
    if (!campaign) {
      throw new Error('bundled campaign missing');
    }
    mockTrackEvent.mockImplementation(() => {
      throw new Error('analytics unavailable');
    });
    const { result } = await renderHook(() => useFeatureDiscoveryHub());

    // When
    await act(async () => {
      result.current.openHub({
        accountId: 'user-1',
        campaign,
        source: 'auto',
      });
    });

    // Then
    expect(mockOverlayOpen).toHaveBeenCalledTimes(1);
    if (!renderedOverlay) {
      throw new Error('overlay was not rendered');
    }
    const overlay = await render(<View>{renderedOverlay}</View>);

    // When
    await fireEvent.press(overlay.getByText('메모 기능으로 이동'));

    // Then
    expect(mockClose).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/memo/create');
  });

  it('계정 조회 전에는 허브를 열어 seen과 귀속이 누락되는 경합을 만들지 않는다', async () => {
    // Given
    if (!campaign) {
      throw new Error('bundled campaign missing');
    }
    const { result } = await renderHook(() => useFeatureDiscoveryHub());

    // When
    await act(async () => {
      result.current.openHub({
        accountId: undefined as never,
        campaign,
        source: 'mypage',
      });
    });

    // Then
    expect(mockOverlayOpen).not.toHaveBeenCalled();
  });
});
