import { render, screen } from '@testing-library/react-native';
import { VStack } from './VStack';

describe('VStack 컴포넌트', () => {
  it('children을 렌더링해야 한다', () => {
    render(
      <VStack testID="parent">
        <VStack testID="child">콘텐츠</VStack>
      </VStack>,
    );

    expect(screen.getByTestId('child')).toBeTruthy();
  });

  it('기본적으로 flex-col 클래스를 적용해야 한다', () => {
    render(<VStack testID="vstack">콘텐츠</VStack>);
    const vstack = screen.getByTestId('vstack');

    expect(vstack.props.className).toContain('flex-col');
  });

  it('justify prop을 적용해야 한다', () => {
    render(
      <VStack testID="vstack" justify="center">
        콘텐츠
      </VStack>,
    );
    const vstack = screen.getByTestId('vstack');

    expect(vstack.props.className).toContain('justify-center');
  });

  it('align prop을 적용해야 한다', () => {
    render(
      <VStack testID="vstack" align="start">
        콘텐츠
      </VStack>,
    );
    const vstack = screen.getByTestId('vstack');

    expect(vstack.props.className).toContain('items-start');
  });

  it('gap prop을 적용해야 한다', () => {
    render(
      <VStack testID="vstack" gap={16}>
        콘텐츠
      </VStack>,
    );
    const vstack = screen.getByTestId('vstack');

    expect(vstack.props.style).toEqual([{ gap: 16 }, undefined]);
  });

  it('wrap prop을 적용해야 한다', () => {
    render(
      <VStack testID="vstack" wrap="wrap">
        콘텐츠
      </VStack>,
    );
    const vstack = screen.getByTestId('vstack');

    expect(vstack.props.className).toContain('flex-wrap');
  });

  it('className을 병합해야 한다', () => {
    render(
      <VStack testID="vstack" className="p-4">
        콘텐츠
      </VStack>,
    );
    const vstack = screen.getByTestId('vstack');

    expect(vstack.props.className).toContain('flex-col');
    expect(vstack.props.className).toContain('p-4');
  });

  it('style prop을 적용해야 한다', () => {
    render(
      <VStack testID="vstack" style={{ backgroundColor: 'green' }}>
        콘텐츠
      </VStack>,
    );
    const vstack = screen.getByTestId('vstack');

    expect(vstack.props.style).toContainEqual({ backgroundColor: 'green' });
  });

  it('여러 자식 요소를 수직으로 렌더링해야 한다', () => {
    render(
      <VStack testID="vstack">
        <VStack testID="child1">첫 번째</VStack>
        <VStack testID="child2">두 번째</VStack>
      </VStack>,
    );

    expect(screen.getByTestId('child1')).toBeTruthy();
    expect(screen.getByTestId('child2')).toBeTruthy();
  });
});
