import { renderScreen } from '@src/testing/render';
import { screen } from '@testing-library/react-native';

import { PawIcon } from '../icon';
import { IconCircle } from './icon-circle';

describe('IconCircle', () => {
  it('이름이 없으면 장식이라 읽기 도구에 보이지 않는다', async () => {
    // When
    await renderScreen(<IconCircle tone="brand" icon={<PawIcon />} testID="circle" />);

    // Then
    expect(screen.getByTestId('circle', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.queryByTestId('circle')).toBeNull();
  });

  it('이름을 받으면 그 이름의 그림으로 읽힌다', async () => {
    // When
    await renderScreen(<IconCircle icon={<PawIcon />} accessibilityLabel="체험 시작, 오늘" />);

    // Then
    expect(screen.getByRole('image', { name: '체험 시작, 오늘' })).toBeOnTheScreen();
  });
});
