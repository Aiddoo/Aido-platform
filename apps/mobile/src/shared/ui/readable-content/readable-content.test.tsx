import { render, screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';

import { READABLE_CONTENT_MAX_WIDTH, ReadableContent } from './readable-content';

describe('ReadableContent 컴포넌트', () => {
  it('내용을 최대 폭으로 제한하고 Box 간격 props를 함께 적용한다', async () => {
    await render(
      <ReadableContent testID="readable-content" flex={1} px={16}>
        <Text>로그인</Text>
      </ReadableContent>,
    );

    expect(screen.getByText('로그인')).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByTestId('readable-content').props.style)).toEqual({
      flex: 1,
      paddingHorizontal: 16,
      maxWidth: READABLE_CONTENT_MAX_WIDTH,
    });
  });
});
