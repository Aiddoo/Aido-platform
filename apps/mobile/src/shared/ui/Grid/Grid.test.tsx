import { render, screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import { Grid } from './Grid';
import { GridItem } from './GridItem';

describe('Grid 컴포넌트', () => {
  it('children을 렌더링해야 한다', () => {
    render(
      <Grid testID="grid">
        <Text>콘텐츠</Text>
      </Grid>,
    );

    expect(screen.getByText('콘텐츠')).toBeTruthy();
  });

  it('기본적으로 flex-row, flex-wrap 클래스를 적용해야 한다', () => {
    render(<Grid testID="grid">콘텐츠</Grid>);
    const grid = screen.getByTestId('grid');

    expect(grid.props.className).toContain('flex-row');
    expect(grid.props.className).toContain('flex-wrap');
  });

  it('gap prop을 style로 적용해야 한다', () => {
    render(
      <Grid testID="grid" gap={8}>
        콘텐츠
      </Grid>,
    );
    const style = StyleSheet.flatten(screen.getByTestId('grid').props.style);

    expect(style.gap).toBe(8);
  });

  it('rowGap prop을 style로 적용해야 한다', () => {
    render(
      <Grid testID="grid" rowGap={12}>
        콘텐츠
      </Grid>,
    );
    const style = StyleSheet.flatten(screen.getByTestId('grid').props.style);

    expect(style.rowGap).toBe(12);
  });

  it('columnGap prop을 style로 적용해야 한다', () => {
    render(
      <Grid testID="grid" columnGap={16}>
        콘텐츠
      </Grid>,
    );
    const style = StyleSheet.flatten(screen.getByTestId('grid').props.style);

    expect(style.columnGap).toBe(16);
  });

  it('rowGap과 columnGap을 동시에 적용해야 한다', () => {
    render(
      <Grid testID="grid" rowGap={12} columnGap={8}>
        콘텐츠
      </Grid>,
    );
    const style = StyleSheet.flatten(screen.getByTestId('grid').props.style);

    expect(style.rowGap).toBe(12);
    expect(style.columnGap).toBe(8);
  });

  it('className을 병합해야 한다', () => {
    render(
      <Grid testID="grid" className="bg-white">
        콘텐츠
      </Grid>,
    );
    const grid = screen.getByTestId('grid');

    expect(grid.props.className).toContain('flex-row');
    expect(grid.props.className).toContain('flex-wrap');
    expect(grid.props.className).toContain('bg-white');
  });

  it('style을 병합해야 한다', () => {
    render(
      <Grid testID="grid" style={{ borderRadius: 16 }}>
        콘텐츠
      </Grid>,
    );
    const style = StyleSheet.flatten(screen.getByTestId('grid').props.style);

    expect(style.borderRadius).toBe(16);
  });

  it('columns prop에 따라 GridItem의 width를 결정해야 한다', () => {
    render(
      <Grid columns={3}>
        <GridItem testID="item">아이템</GridItem>
      </Grid>,
    );
    const style = StyleSheet.flatten(screen.getByTestId('item').props.style);

    expect(style.width).toBe('33.33333333333333%');
  });
});

describe('GridItem 컴포넌트', () => {
  it('children을 렌더링해야 한다', () => {
    render(
      <Grid columns={3}>
        <GridItem>
          <Text>콘텐츠</Text>
        </GridItem>
      </Grid>,
    );

    expect(screen.getByText('콘텐츠')).toBeTruthy();
  });

  it('Grid(columns=3) 안에서 기본 width를 계산해야 한다', () => {
    render(
      <Grid columns={3}>
        <GridItem testID="item">아이템</GridItem>
      </Grid>,
    );
    const style = StyleSheet.flatten(screen.getByTestId('item').props.style);

    expect(style.width).toBe('33.33333333333333%');
  });

  it('colSpan=2일 때 width를 올바르게 계산해야 한다', () => {
    render(
      <Grid columns={3}>
        <GridItem testID="item" colSpan={2}>
          아이템
        </GridItem>
      </Grid>,
    );
    const style = StyleSheet.flatten(screen.getByTestId('item').props.style);

    expect(style.width).toBe('66.66666666666666%');
  });

  it('Grid 없이 단독 사용 시 width가 100%여야 한다', () => {
    render(<GridItem testID="item">아이템</GridItem>);
    const style = StyleSheet.flatten(screen.getByTestId('item').props.style);

    expect(style.width).toBe('100%');
  });

  it('className을 적용해야 한다', () => {
    render(
      <Grid columns={3}>
        <GridItem testID="item" className="items-center">
          아이템
        </GridItem>
      </Grid>,
    );

    expect(screen.getByTestId('item').props.className).toContain('items-center');
  });

  it('style을 병합해야 한다', () => {
    render(
      <Grid columns={3}>
        <GridItem testID="item" style={{ borderRadius: 8 }}>
          아이템
        </GridItem>
      </Grid>,
    );
    const style = StyleSheet.flatten(screen.getByTestId('item').props.style);

    expect(style.width).toBe('33.33333333333333%');
    expect(style.borderRadius).toBe(8);
  });

  it('p prop을 적용해야 한다', () => {
    render(
      <Grid columns={2}>
        <GridItem testID="item" p={8}>
          아이템
        </GridItem>
      </Grid>,
    );
    const style = StyleSheet.flatten(screen.getByTestId('item').props.style);

    expect(style.width).toBe('50%');
    expect(style.padding).toBe(8);
  });
});
