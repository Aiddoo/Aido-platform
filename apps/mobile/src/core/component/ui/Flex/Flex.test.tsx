import { render, screen } from '@testing-library/react-native';
import { Flex } from './Flex';
import { flexVariants } from './Flex.variants';

describe('flexVariants 함수', () => {
  it('기본 클래스를 포함해야 한다', () => {
    const classes = flexVariants({});
    expect(classes).toContain('flex');
    expect(classes).toContain('flex-row');
    expect(classes).toContain('flex-nowrap');
    expect(classes).toContain('justify-start');
    expect(classes).toContain('items-stretch');
  });

  it('direction에 따른 클래스를 반환해야 한다', () => {
    expect(flexVariants({ direction: 'row' })).toContain('flex-row');
    expect(flexVariants({ direction: 'column' })).toContain('flex-col');
    expect(flexVariants({ direction: 'row-reverse' })).toContain('flex-row-reverse');
    expect(flexVariants({ direction: 'column-reverse' })).toContain('flex-col-reverse');
  });

  it('wrap에 따른 클래스를 반환해야 한다', () => {
    expect(flexVariants({ wrap: 'wrap' })).toContain('flex-wrap');
    expect(flexVariants({ wrap: 'nowrap' })).toContain('flex-nowrap');
    expect(flexVariants({ wrap: 'wrap-reverse' })).toContain('flex-wrap-reverse');
  });

  it('justify에 따른 클래스를 반환해야 한다', () => {
    expect(flexVariants({ justify: 'start' })).toContain('justify-start');
    expect(flexVariants({ justify: 'center' })).toContain('justify-center');
    expect(flexVariants({ justify: 'end' })).toContain('justify-end');
    expect(flexVariants({ justify: 'between' })).toContain('justify-between');
    expect(flexVariants({ justify: 'around' })).toContain('justify-around');
    expect(flexVariants({ justify: 'evenly' })).toContain('justify-evenly');
  });

  it('align에 따른 클래스를 반환해야 한다', () => {
    expect(flexVariants({ align: 'start' })).toContain('items-start');
    expect(flexVariants({ align: 'center' })).toContain('items-center');
    expect(flexVariants({ align: 'end' })).toContain('items-end');
    expect(flexVariants({ align: 'stretch' })).toContain('items-stretch');
    expect(flexVariants({ align: 'baseline' })).toContain('items-baseline');
  });

  it('여러 variant 조합 시 모든 클래스를 포함해야 한다', () => {
    const classes = flexVariants({
      direction: 'column',
      wrap: 'wrap',
      justify: 'center',
      align: 'center',
    });
    expect(classes).toContain('flex-col');
    expect(classes).toContain('flex-wrap');
    expect(classes).toContain('justify-center');
    expect(classes).toContain('items-center');
  });
});

describe('Flex 컴포넌트', () => {
  it('기본 스타일을 적용해야 한다', () => {
    render(<Flex testID="flex">콘텐츠</Flex>);
    const flex = screen.getByTestId('flex');

    expect(flex.props.className).toContain('flex');
    expect(flex.props.className).toContain('flex-row');
    expect(flex.props.className).toContain('flex-nowrap');
    expect(flex.props.className).toContain('justify-start');
    expect(flex.props.className).toContain('items-stretch');
  });

  it('direction prop을 적용해야 한다', () => {
    render(
      <Flex testID="flex" direction="column">
        콘텐츠
      </Flex>,
    );
    const flex = screen.getByTestId('flex');

    expect(flex.props.className).toContain('flex-col');
  });

  it('wrap prop을 적용해야 한다', () => {
    render(
      <Flex testID="flex" wrap="wrap">
        콘텐츠
      </Flex>,
    );
    const flex = screen.getByTestId('flex');

    expect(flex.props.className).toContain('flex-wrap');
  });

  it('justify prop을 적용해야 한다', () => {
    render(
      <Flex testID="flex" justify="between">
        콘텐츠
      </Flex>,
    );
    const flex = screen.getByTestId('flex');

    expect(flex.props.className).toContain('justify-between');
  });

  it('align prop을 적용해야 한다', () => {
    render(
      <Flex testID="flex" align="center">
        콘텐츠
      </Flex>,
    );
    const flex = screen.getByTestId('flex');

    expect(flex.props.className).toContain('items-center');
  });

  it('gap prop을 style로 적용해야 한다', () => {
    render(
      <Flex testID="flex" gap={16}>
        콘텐츠
      </Flex>,
    );
    const flex = screen.getByTestId('flex');

    expect(flex.props.style).toEqual([{ gap: 16 }, undefined]);
  });

  it('className을 병합해야 한다', () => {
    render(
      <Flex testID="flex" className="mt-4">
        콘텐츠
      </Flex>,
    );
    const flex = screen.getByTestId('flex');

    expect(flex.props.className).toContain('flex');
    expect(flex.props.className).toContain('mt-4');
  });

  it('style prop을 적용해야 한다', () => {
    render(
      <Flex testID="flex" style={{ backgroundColor: 'red' }}>
        콘텐츠
      </Flex>,
    );
    const flex = screen.getByTestId('flex');

    expect(flex.props.style).toEqual([undefined, { backgroundColor: 'red' }]);
  });

  it('gap과 style을 함께 적용해야 한다', () => {
    render(
      <Flex testID="flex" gap={8} style={{ padding: 10 }}>
        콘텐츠
      </Flex>,
    );
    const flex = screen.getByTestId('flex');

    expect(flex.props.style).toEqual([{ gap: 8 }, { padding: 10 }]);
  });

  it('children을 렌더링해야 한다', () => {
    render(
      <Flex testID="parent">
        <Flex testID="child">자식 요소</Flex>
      </Flex>,
    );

    expect(screen.getByTestId('child')).toBeTruthy();
  });
});
