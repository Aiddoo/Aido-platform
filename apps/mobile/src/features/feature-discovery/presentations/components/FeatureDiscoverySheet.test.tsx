import { getBundledFeatureDiscoveryCampaign } from '@src/features/feature-discovery/models/feature-discovery.registry';
import '@src/shared/i18n/init';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { FEATURE_DISCOVERY_CAMPAIGN_ID } from '../../models/feature-discovery.registry';
import { FeatureDiscoverySheet } from './FeatureDiscoverySheet';

jest.mock('@src/shared/hooks/use-prefers-reduced-motion', () => ({
  usePrefersReducedMotion: () => true,
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
    H3: Text,
    HStack: Container,
    VStack: Container,
    Text,
    Button,
    TextButton: Button,
    ModalBottomSheet: ({
      isOpen,
      children,
      reduceMotion,
    }: {
      isOpen: boolean;
      children: React.ReactNode;
      reduceMotion: boolean;
    }) =>
      isOpen
        ? React.createElement(
            View,
            { testID: 'modal-sheet', accessibilityValue: { text: String(reduceMotion) } },
            children,
          )
        : null,
    CheckIcon: () => null,
    DragIcon: () => null,
    MemoIcon: () => null,
    PersonIcon: () => null,
    RepeatIcon: () => null,
    RobotIcon: () => null,
    SearchIcon: () => null,
  };
});

const campaign = getBundledFeatureDiscoveryCampaign(FEATURE_DISCOVERY_CAMPAIGN_ID);

describe('FeatureDiscoverySheet', () => {
  it('작은 화면에서도 네 카드와 CTA를 스크롤 콘텐츠로 렌더링한다', async () => {
    // Given
    if (!campaign) {
      throw new Error('bundled campaign missing');
    }

    // When
    await render(
      <FeatureDiscoverySheet
        isOpen
        campaign={campaign}
        onDismiss={jest.fn()}
        onExit={jest.fn()}
        onCardCta={jest.fn()}
        viewportHeight={480}
      />,
    );

    // Then
    expect(screen.getByText('메모가 여러 할 일이 돼요')).toBeTruthy();
    expect(screen.getByText('이름이나 Aido ID로 친구를 찾아요')).toBeTruthy();
    expect(screen.getByText('드래그해서 원하는 순서로 정리해요')).toBeTruthy();
    expect(screen.getByText('나에게 맞는 방식으로 할 일을 만들어요')).toBeTruthy();
    expect(screen.getByTestId('feature-discovery-card-list')).toBeTruthy();
  });

  it('닫기와 카드 CTA를 각각 호출하고 모션 감소를 시트에 전달한다', async () => {
    // Given
    if (!campaign) {
      throw new Error('bundled campaign missing');
    }
    const onDismiss = jest.fn();
    const onCardCta = jest.fn();
    await render(
      <FeatureDiscoverySheet
        isOpen
        campaign={campaign}
        onDismiss={onDismiss}
        onExit={jest.fn()}
        onCardCta={onCardCta}
        viewportHeight={800}
      />,
    );

    // When
    await fireEvent.press(screen.getByLabelText('기능 가이드 닫기'));
    await fireEvent.press(screen.getByLabelText('친구 찾기 기능으로 이동'));

    // Then
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onCardCta).toHaveBeenCalledWith('friend_search');
    expect(screen.getByTestId('modal-sheet').props.accessibilityValue.text).toBe('true');
  });
});
