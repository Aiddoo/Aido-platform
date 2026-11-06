import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Pressable, Text } from 'react-native';

import { useNotificationDirectionParam } from './use-notification-direction-param';

// renderRouter는 실제 라우터로 URL·이동을 검증하므로 jest.setup의 전역 mock을 끈다
jest.unmock('expo-router');

function DirectionProbe() {
  const [direction, setDirection] = useNotificationDirectionParam();
  return (
    <Pressable onPress={() => setDirection('sent')}>
      <Text testID="direction">{direction}</Text>
    </Pressable>
  );
}

describe('useNotificationDirectionParam', () => {
  it('URL의 direction=sent를 보낸 콕으로 읽는다', async () => {
    // Given
    // When
    await renderRouter(
      { index: DirectionProbe },
      { initialUrl: '/?category=SOCIAL&direction=sent' },
    );

    // Then
    expect(screen.getByTestId('direction')).toHaveTextContent('sent');
  });

  it.each(['/', '/?direction=unknown'])(
    'direction이 없거나 잘못되면 받은 알림으로 본다: %s',
    async (initialUrl) => {
      // Given
      // When
      await renderRouter({ index: DirectionProbe }, { initialUrl });

      // Then
      expect(screen.getByTestId('direction')).toHaveTextContent('received');
    },
  );

  it('setter는 URL의 direction param을 바꾼다', async () => {
    // Given
    await renderRouter({ index: DirectionProbe }, { initialUrl: '/' });

    // When
    await fireEvent.press(screen.getByTestId('direction'));

    // Then
    expect(screen).toHaveSearchParams({ direction: 'sent' });
  });
});
