import { render, screen } from '@testing-library/react-native';
import { HStack } from '../HStack';

describe('HStack 컴포넌트', () => {
  it('children을 렌더링해야 한다', () => {
    render(
      <HStack testID="parent">
        <HStack testID="child">콘텐츠</HStack>
      </HStack>,
    );

    expect(screen.getByTestId('child')).toBeTruthy();
  });

  it('기본적으로 flex-row 클래스를 적용해야 한다', () => {
    render(<HStack testID="hstack">콘텐츠</HStack>);
    const hstack = screen.getByTestId('hstack');

    expect(hstack.props.className).toContain('flex-row');
  });

  it('justify prop을 적용해야 한다', () => {
    render(
      <HStack testID="hstack" justify="between">
        콘텐츠
      </HStack>,
    );
    const hstack = screen.getByTestId('hstack');

    expect(hstack.props.className).toContain('justify-between');
  });

  it('align prop을 적용해야 한다', () => {
    render(
      <HStack testID="hstack" align="center">
        콘텐츠
      </HStack>,
    );
    const hstack = screen.getByTestId('hstack');

    expect(hstack.props.className).toContain('items-center');
  });

  it('gap prop을 적용해야 한다', () => {
    render(
      <HStack testID="hstack" gap={8}>
        콘텐츠
      </HStack>,
    );
    const hstack = screen.getByTestId('hstack');

    expect(hstack.props.style).toEqual([{ gap: 8 }, undefined]);
  });

  it('wrap prop을 적용해야 한다', () => {
    render(
      <HStack testID="hstack" wrap="wrap">
        콘텐츠
      </HStack>,
    );
    const hstack = screen.getByTestId('hstack');

    expect(hstack.props.className).toContain('flex-wrap');
  });

  it('className을 병합해야 한다', () => {
    render(
      <HStack testID="hstack" className="mt-4">
        콘텐츠
      </HStack>,
    );
    const hstack = screen.getByTestId('hstack');

    expect(hstack.props.className).toContain('flex-row');
    expect(hstack.props.className).toContain('mt-4');
  });

  it('여러 자식 요소를 수평으로 렌더링해야 한다', () => {
    render(
      <HStack testID="hstack">
        <HStack testID="child1">첫 번째</HStack>
        <HStack testID="child2">두 번째</HStack>
      </HStack>,
    );

    expect(screen.getByTestId('child1')).toBeTruthy();
    expect(screen.getByTestId('child2')).toBeTruthy();
  });
});
