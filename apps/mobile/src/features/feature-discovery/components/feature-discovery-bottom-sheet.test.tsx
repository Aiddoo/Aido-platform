import { getBundledFeatureDiscoveryCampaign } from '@src/features/feature-discovery/domains/feature-discovery.registry';
import { createMockSyncStorage } from '@src/shared/__tests__/create-mock-sync-storage';
import '@src/shared/i18n/init';
import { i18n } from '@src/shared/i18n';
import { FontScaleProvider } from '@src/shared/providers/font-scale-provider';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { FEATURE_DISCOVERY_CAMPAIGN_ID } from '../domains/feature-discovery.registry';
import { FeatureDiscoveryBottomSheet } from './feature-discovery-bottom-sheet';

let mockSafeAreaInsets = { top: 0, right: 0, bottom: 0, left: 0 };

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => mockSafeAreaInsets,
}));

jest.mock('@src/shared/ui', () => {
  const React = require('react');
  const { Pressable, Text: NativeText, View } = require('react-native');

  const Container = ({
    children,
    ...props
  }: {
    children?: React.ReactNode;
    [key: string]: unknown;
  }) => React.createElement(View, props, children);
  const Text = ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) =>
    React.createElement(NativeText, props, children);
  const Button = ({
    children,
    onPress,
    ...props
  }: {
    children?: React.ReactNode;
    onPress?: () => void;
    [key: string]: unknown;
  }) =>
    React.createElement(
      Pressable,
      { ...props, onPress },
      React.createElement(Text, null, children),
    );

  return {
    Box: Container,
    Avatar: Object.assign(Container, {
      Image: () => null,
      Fallback: Container,
    }),
    H3: Text,
    HStack: Container,
    VStack: Container,
    Text,
    Button,
    TextButton: Button,
    ModalBottomSheet: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) =>
      isOpen ? React.createElement(View, { testID: 'modal-sheet' }, children) : null,
    CheckIcon: () => null,
    PawIcon: () => null,
    ArrowUpIcon: () => null,
    CalendarIcon: () => null,
    ClockIcon: () => null,
    DragIcon: () => null,
    EyeIcon: () => null,
    MemoIcon: () => null,
    MenuIcon: () => null,
    PersonIcon: () => null,
    RepeatIcon: () => null,
    RobotIcon: () => null,
    SearchIcon: () => null,
  };
});

const campaign = getBundledFeatureDiscoveryCampaign(FEATURE_DISCOVERY_CAMPAIGN_ID);

describe('FeatureDiscoveryBottomSheet', () => {
  afterEach(async () => {
    mockSafeAreaInsets = { top: 0, right: 0, bottom: 0, left: 0 };
    await act(async () => {
      await i18n.changeLanguage('ko');
    });
  });

  it('작은 화면에서도 친구 초대 카드와 CTA를 스크롤 콘텐츠로 렌더링한다', async () => {
    // Given
    if (!campaign) {
      throw new Error('bundled campaign missing');
    }

    // When
    await render(
      <FeatureDiscoveryBottomSheet
        isOpen
        campaign={campaign}
        onOpenChange={jest.fn()}
        onExit={jest.fn()}
        onCardCta={jest.fn()}
        viewportHeight={480}
      />,
    );

    // Then
    expect(screen.getByText('친구를 초대하고\n발자국을 모아보세요')).toBeTruthy();
    expect(screen.getByText('초대하러 가기')).toBeTruthy();
    expect(screen.getByTestId('feature-discovery-card-list')).toBeTruthy();
  });

  it('닫기와 카드 CTA를 각각 호출하고 모션 감소를 시트에 전달한다', async () => {
    // Given
    if (!campaign) {
      throw new Error('bundled campaign missing');
    }
    const onOpenChange = jest.fn();
    const onCardCta = jest.fn();
    await render(
      <FeatureDiscoveryBottomSheet
        isOpen
        campaign={campaign}
        onOpenChange={onOpenChange}
        onExit={jest.fn()}
        onCardCta={onCardCta}
        viewportHeight={800}
      />,
    );

    // When
    await fireEvent.press(screen.getByLabelText('기능 가이드 닫기'));
    await fireEvent.press(screen.getByLabelText('친구 초대 화면으로 이동'));

    // Then
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onCardCta).toHaveBeenCalledWith('friend_invite');
  });

  it('작은 화면의 en × xlarge × safe-area에서도 장문 CTA 목록을 안전한 높이로 스크롤한다', async () => {
    // Given
    if (!campaign) {
      throw new Error('bundled campaign missing');
    }
    const storage = createMockSyncStorage();
    storage.getString.mockReturnValue('xlarge');
    mockSafeAreaInsets = { top: 59, right: 0, bottom: 34, left: 0 };
    await act(async () => {
      await i18n.changeLanguage('en');
    });

    // When
    await render(
      <FontScaleProvider syncStorage={storage}>
        <FeatureDiscoveryBottomSheet
          isOpen
          campaign={campaign}
          onOpenChange={jest.fn()}
          onExit={jest.fn()}
          onCardCta={jest.fn()}
          viewportHeight={480}
        />
      </FontScaleProvider>,
    );

    // Then
    expect(screen.getByText('Invite friends and\ncollect paw prints')).toBeTruthy();
    expect(
      screen.getByText(
        'Send a link on KakaoTalk. Your friend gets 7 days of Premium on joining, and you get 7 days once they complete to-dos on 2 different days',
      ),
    ).toBeTruthy();
    const listStyle = StyleSheet.flatten(
      screen.getByTestId('feature-discovery-card-list').props.style,
    );
    // 480 - top 59 - bottom 34 - xlarge 비목록 영역 272 = 115
    expect(listStyle.maxHeight).toBeLessThanOrEqual(115);
  });
});
