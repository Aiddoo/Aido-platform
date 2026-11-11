import { render, screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';

import { Grid } from './grid';
import { GridItem } from './grid-item';

describe('Grid 컴포넌트', () => {
  it('gap prop은 행 간격으로 주고 flex 열 간격은 쓰지 않는다', async () => {
    // Given
    await render(
      <Grid testID="grid" gap={8}>
        <Text>콘텐츠</Text>
      </Grid>,
    );

    // When
    // oxlint-disable-next-line aido/no-style-assertion -- 1.15.2 전환 #1400
    const style = StyleSheet.flatten(screen.getByTestId('grid').props.style);

    // Then
    expect(style.rowGap).toBe(8);
    expect(style.gap).toBeUndefined();
    expect(style.columnGap).toBeUndefined();
  });

  it('columnGap은 flex gap 대신 GridItem 좌우 padding으로 나눠 한 줄이 넘치지 않게 한다', async () => {
    // Given
    await render(
      <Grid testID="grid" rowGap={12} columnGap={10} columns={2}>
        <GridItem testID="first">
          <Text>왼쪽</Text>
        </GridItem>
        <GridItem testID="second">
          <Text>오른쪽</Text>
        </GridItem>
      </Grid>,
    );

    // When
    // oxlint-disable-next-line aido/no-style-assertion -- 1.15.2 전환 #1400
    const gridStyle = StyleSheet.flatten(screen.getByTestId('grid').props.style);
    // oxlint-disable-next-line aido/no-style-assertion -- 1.15.2 전환 #1400
    const firstCell = StyleSheet.flatten(screen.getByTestId('first').parent?.props.style);
    // oxlint-disable-next-line aido/no-style-assertion -- 1.15.2 전환 #1400
    const secondCell = StyleSheet.flatten(screen.getByTestId('second').parent?.props.style);

    // Then
    expect(gridStyle.rowGap).toBe(12);
    expect(gridStyle.columnGap).toBeUndefined();
    expect(firstCell).toEqual({ width: '50%', paddingLeft: 0, paddingRight: 5 });
    expect(secondCell).toEqual({ width: '50%', paddingLeft: 5, paddingRight: 0 });
  });

  it('columnGap이 있어도 GridItem의 className·style은 간격 안쪽 칸에 준다', async () => {
    // Given
    await render(
      <Grid columns={2} columnGap={10}>
        <GridItem testID="item" className="bg-gray-2" style={{ borderRadius: 8 }}>
          <Text>아이템</Text>
        </GridItem>
      </Grid>,
    );

    // When
    const item = screen.getByTestId('item');
    // oxlint-disable-next-line aido/no-style-assertion -- 1.15.2 전환 #1400
    const style = StyleSheet.flatten(item.props.style);

    // Then
    expect(item.props.className).toContain('bg-gray-2');
    expect(style.borderRadius).toBe(8);
    expect(style.width).toBeUndefined();
  });
});

describe('GridItem 컴포넌트', () => {
  it('3열 Grid에서 colSpan=2이면 너비는 3분의 2이다', async () => {
    // Given
    await render(
      <Grid columns={3}>
        <GridItem testID="item" colSpan={2}>
          <Text>아이템</Text>
        </GridItem>
      </Grid>,
    );

    // When
    // oxlint-disable-next-line aido/no-style-assertion -- 1.15.2 전환 #1400
    const style = StyleSheet.flatten(screen.getByTestId('item').props.style);

    // Then
    expect(style.width).toBe('66.66666666666666%');
  });

  it('Grid 없이 단독으로 쓰면 너비는 100%이다', async () => {
    // Given
    await render(
      <GridItem testID="item">
        <Text>아이템</Text>
      </GridItem>,
    );

    // When
    // oxlint-disable-next-line aido/no-style-assertion -- 1.15.2 전환 #1400
    const style = StyleSheet.flatten(screen.getByTestId('item').props.style);

    // Then
    expect(style.width).toBe('100%');
  });
});
