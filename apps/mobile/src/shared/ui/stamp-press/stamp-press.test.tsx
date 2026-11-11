import { renderScreen } from '@src/testing/render';
import { screen } from '@testing-library/react-native';

import { Box } from '../box';
import { StampPress, getStampPressStartProgress } from './stamp-press';

describe('getStampPressStartProgress', () => {
  it('동작 줄이기가 켜져 있으면 찍힌 모습에서 시작해 재생하지 않는다', () => {
    // When
    const progress = getStampPressStartProgress(true);

    // Then
    expect(progress).toBe(1);
  });

  it('동작 줄이기가 꺼져 있으면 떠 있는 모습에서 시작해 한 번 찍는다', () => {
    // When
    const progress = getStampPressStartProgress(false);

    // Then
    expect(progress).toBe(0);
  });
});

describe('StampPress', () => {
  // 높이가 정해지지 않은 세로 목록(ScrollView 안 VStack)에서 도장이 늘어나면 아래 제목·목록이 스크롤 밖으로 밀려 안 보인다
  it('도장 자리는 children 크기만 차지하고 남는 세로 공간으로 늘어나지 않는다', async () => {
    // When
    await renderScreen(
      <StampPress>
        <Box testID="stamp-seal" style={{ width: 72, height: 72 }} />
      </StampPress>,
    );

    // Then
    const stamp = screen.getByTestId('stamp-seal').parent;
    expect(stamp).not.toBeNull();
    // oxlint-disable-next-line aido/no-style-assertion -- 1.15.2 전환 #1400
    expect(stamp).not.toHaveStyle({ flexGrow: 1 });
    // oxlint-disable-next-line aido/no-style-assertion -- 1.15.2 전환 #1400
    expect(stamp).not.toHaveStyle({ flex: 1 });
  });
});
