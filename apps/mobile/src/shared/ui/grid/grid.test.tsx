import { render, screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';

import { Grid } from './grid';
import { GridItem } from './grid-item';

describe('Grid 컴포넌트', () => {
  it('children을 렌더링해야 한다', async () => {
    await render(
      <Grid testID="grid">
        <Text>
          <Text>콘텐츠</Text>
        </Text>
      </Grid>,
    );

    expect(screen.getByText('콘텐츠')).toBeTruthy();
  });

  it('기본적으로 flex-row, flex-wrap 클래스를 적용해야 한다', async () => {
    await render(
      <Grid testID="grid">
        <Text>콘텐츠</Text>
      </Grid>,
    );
    const grid = screen.getByTestId('grid');

    expect(grid.props.className).toContain('flex-row');
    expect(grid.props.className).toContain('flex-wrap');
  });

  it('gap prop은 행 간격으로 주고 flex 열 간격은 쓰지 않는다', async () => {
    await render(
      <Grid testID="grid" gap={8}>
        <Text>콘텐츠</Text>
      </Grid>,
    );
    const style = StyleSheet.flatten(screen.getByTestId('grid').props.style);

    expect(style.rowGap).toBe(8);
    expect(style.gap).toBeUndefined();
    expect(style.columnGap).toBeUndefined();
  });

  it('rowGap prop을 style로 적용해야 한다', async () => {
    await render(
      <Grid testID="grid" rowGap={12}>
        <Text>콘텐츠</Text>
      </Grid>,
    );
    const style = StyleSheet.flatten(screen.getByTestId('grid').props.style);

    expect(style.rowGap).toBe(12);
  });

  it('columnGap은 flex gap 대신 GridItem 좌우 padding으로 나눠 한 줄이 넘치지 않게 한다', async () => {
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
    const gridStyle = StyleSheet.flatten(screen.getByTestId('grid').props.style);
    const firstCell = StyleSheet.flatten(screen.getByTestId('first').parent?.props.style);
    const secondCell = StyleSheet.flatten(screen.getByTestId('second').parent?.props.style);

    expect(gridStyle.rowGap).toBe(12);
    expect(gridStyle.columnGap).toBeUndefined();
    expect(firstCell).toEqual({ width: '50%', paddingLeft: 0, paddingRight: 5 });
    expect(secondCell).toEqual({ width: '50%', paddingLeft: 5, paddingRight: 0 });
  });

  it('columnGap이 있어도 GridItem의 className·style은 간격 안쪽 칸에 준다', async () => {
    await render(
      <Grid columns={2} columnGap={10}>
        <GridItem testID="item" className="bg-gray-2" style={{ borderRadius: 8 }}>
          <Text>아이템</Text>
        </GridItem>
      </Grid>,
    );
    const item = screen.getByTestId('item');
    const style = StyleSheet.flatten(item.props.style);

    expect(item.props.className).toContain('bg-gray-2');
    expect(style.borderRadius).toBe(8);
    expect(style.width).toBeUndefined();
  });

  it('className을 병합해야 한다', async () => {
    await render(
      <Grid testID="grid" className="bg-white">
        <Text>콘텐츠</Text>
      </Grid>,
    );
    const grid = screen.getByTestId('grid');

    expect(grid.props.className).toContain('flex-row');
    expect(grid.props.className).toContain('flex-wrap');
    expect(grid.props.className).toContain('bg-white');
  });

  it('style을 병합해야 한다', async () => {
    await render(
      <Grid testID="grid" style={{ borderRadius: 16 }}>
        <Text>콘텐츠</Text>
      </Grid>,
    );
    const style = StyleSheet.flatten(screen.getByTestId('grid').props.style);

    expect(style.borderRadius).toBe(16);
  });

  it('columns prop에 따라 GridItem의 width를 결정해야 한다', async () => {
    await render(
      <Grid columns={3}>
        <GridItem testID="item">
          <Text>아이템</Text>
        </GridItem>
      </Grid>,
    );
    const style = StyleSheet.flatten(screen.getByTestId('item').props.style);

    expect(style.width).toBe('33.33333333333333%');
  });
});

describe('GridItem 컴포넌트', () => {
  it('children을 렌더링해야 한다', async () => {
    await render(
      <Grid columns={3}>
        <GridItem>
          <Text>
            <Text>콘텐츠</Text>
          </Text>
        </GridItem>
      </Grid>,
    );

    expect(screen.getByText('콘텐츠')).toBeTruthy();
  });

  it('Grid(columns=3) 안에서 기본 width를 계산해야 한다', async () => {
    await render(
      <Grid columns={3}>
        <GridItem testID="item">
          <Text>아이템</Text>
        </GridItem>
      </Grid>,
    );
    const style = StyleSheet.flatten(screen.getByTestId('item').props.style);

    expect(style.width).toBe('33.33333333333333%');
  });

  it('colSpan=2일 때 width를 올바르게 계산해야 한다', async () => {
    await render(
      <Grid columns={3}>
        <GridItem testID="item" colSpan={2}>
          <Text>아이템</Text>
        </GridItem>
      </Grid>,
    );
    const style = StyleSheet.flatten(screen.getByTestId('item').props.style);

    expect(style.width).toBe('66.66666666666666%');
  });

  it('Grid 없이 단독 사용 시 width가 100%여야 한다', async () => {
    await render(
      <GridItem testID="item">
        <Text>아이템</Text>
      </GridItem>,
    );
    const style = StyleSheet.flatten(screen.getByTestId('item').props.style);

    expect(style.width).toBe('100%');
  });

  it('className을 적용해야 한다', async () => {
    await render(
      <Grid columns={3}>
        <GridItem testID="item" className="items-center">
          <Text>아이템</Text>
        </GridItem>
      </Grid>,
    );

    expect(screen.getByTestId('item').props.className).toContain('items-center');
  });

  it('style을 병합해야 한다', async () => {
    await render(
      <Grid columns={3}>
        <GridItem testID="item" style={{ borderRadius: 8 }}>
          <Text>아이템</Text>
        </GridItem>
      </Grid>,
    );
    const style = StyleSheet.flatten(screen.getByTestId('item').props.style);

    expect(style.width).toBe('33.33333333333333%');
    expect(style.borderRadius).toBe(8);
  });

  it('p prop을 적용해야 한다', async () => {
    await render(
      <Grid columns={2}>
        <GridItem testID="item" p={8}>
          <Text>아이템</Text>
        </GridItem>
      </Grid>,
    );
    const style = StyleSheet.flatten(screen.getByTestId('item').props.style);

    expect(style.width).toBe('50%');
    expect(style.padding).toBe(8);
  });
});
