import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Pressable, Text } from 'react-native';

import { useNotificationCategoryParam } from './use-notification-category-param';

// renderRouter는 실제 라우터로 URL·이동을 검증하므로 jest.setup의 전역 mock을 끈다
jest.unmock('expo-router');

function CategoryProbe() {
  const [category, setCategory] = useNotificationCategoryParam();
  return (
    <Pressable onPress={() => setCategory('TODO')}>
      <Text testID="category">{category}</Text>
    </Pressable>
  );
}

describe('useNotificationCategoryParam', () => {
  it('URL의 category를 읽는다', async () => {
    // Given
    // When
    await renderRouter({ index: CategoryProbe }, { initialUrl: '/?category=SOCIAL' });

    // Then
    expect(screen.getByTestId('category')).toHaveTextContent('SOCIAL');
  });

  it.each(['/', '/?category=UNKNOWN'])(
    'category가 없거나 잘못되면 전체로 본다: %s',
    async (initialUrl) => {
      // Given
      // When
      await renderRouter({ index: CategoryProbe }, { initialUrl });

      // Then
      expect(screen.getByTestId('category')).toHaveTextContent('ALL');
    },
  );

  it('setter는 URL의 category param을 바꾼다', async () => {
    // Given
    await renderRouter({ index: CategoryProbe }, { initialUrl: '/' });

    // When
    await fireEvent.press(screen.getByTestId('category'));

    // Then
    expect(screen).toHaveSearchParams({ category: 'TODO' });
  });
});
