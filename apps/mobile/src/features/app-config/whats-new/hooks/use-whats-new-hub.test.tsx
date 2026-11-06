import { getBundledWhatsNewCampaign } from '@src/features/app-config/whats-new/domains/whats-new.registry';
import { act, fireEvent, render, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { WHATS_NEW_CAMPAIGN_ID } from '../domains/whats-new.registry';
import { useWhatsNewHub } from './use-whats-new-hub';

const mockTrackEvent = jest.fn();
const mockClose = jest.fn();
const mockUnmount = jest.fn();
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
      unmount: () => void;
    }) => ReactNode,
  ) => {
    renderedOverlay = renderOverlay({
      isOpen: true,
      close: mockClose,
      unmount: mockUnmount,
    });
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

// mock 팩토리는 mockPush 초기화 전에 평가되므로, 호출 시점에 참조하도록 감싼다.
jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
}));

jest.mock('../components/whats-new-bottom-sheet', () => ({
  WhatsNewBottomSheet: ({ onCardCta }: { onCardCta: (cardId: 'friend_invite') => void }) => {
    const React = require('react');
    const { Pressable, Text } = require('react-native');
    return React.createElement(
      Pressable,
      {
        accessibilityRole: 'button',
        onPress: () => onCardCta('friend_invite'),
      },
      React.createElement(Text, null, '메모 기능으로 이동'),
    );
  },
}));

const campaign = getBundledWhatsNewCampaign(WHATS_NEW_CAMPAIGN_ID);

describe('useWhatsNewHub', () => {
  beforeEach(() => {
    renderedOverlay = null;
    mockTrackEvent.mockReset();
    mockClose.mockReset();
    mockUnmount.mockReset();
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
    const { result } = await renderHook(() => useWhatsNewHub());
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
    expect(mockPush).toHaveBeenCalledWith('/friends/invite');
  });

  it('분석 전송 실패에도 허브를 열고 CTA에서 닫기와 이동을 계속한다', async () => {
    // Given
    if (!campaign) {
      throw new Error('bundled campaign missing');
    }
    mockTrackEvent.mockImplementation(() => {
      throw new Error('analytics unavailable');
    });
    const { result } = await renderHook(() => useWhatsNewHub());

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
    expect(mockPush).toHaveBeenCalledWith('/friends/invite');
  });

  it('계정 조회 전에는 허브를 열어 seen과 귀속이 누락되는 경합을 만들지 않는다', async () => {
    // Given
    if (!campaign) {
      throw new Error('bundled campaign missing');
    }
    const { result } = await renderHook(() => useWhatsNewHub());

    // When
    await act(async () => {
      result.current.openHub({
        // @ts-expect-error 계정 조회 전 런타임에 accountId가 비어 들어오는 경우를 방어하는지 확인한다
        accountId: undefined,
        campaign,
        source: 'mypage',
      });
    });

    // Then
    expect(mockOverlayOpen).not.toHaveBeenCalled();
  });
});
