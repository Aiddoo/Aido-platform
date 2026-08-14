import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { VStack } from './VStack';

describe('VStack 컴포넌트', () => {
  it('children을 렌더링해야 한다', async () => {
    await render(
      <VStack testID="parent">
        <VStack testID="child">
          <Text>콘텐츠</Text>
        </VStack>
      </VStack>,
    );

    expect(screen.getByTestId('child')).toBeTruthy();
  });

  it('기본적으로 flex-col 클래스를 적용해야 한다', async () => {
    await render(
      <VStack testID="vstack">
        <Text>콘텐츠</Text>
      </VStack>,
    );
    const vstack = screen.getByTestId('vstack');

    expect(vstack.props.className).toContain('flex-col');
  });

  it('justify prop을 적용해야 한다', async () => {
    await render(
      <VStack testID="vstack" justify="center">
        <Text>콘텐츠</Text>
      </VStack>,
    );
    const vstack = screen.getByTestId('vstack');

    expect(vstack.props.className).toContain('justify-center');
  });

  it('align prop을 적용해야 한다', async () => {
    await render(
      <VStack testID="vstack" align="start">
        <Text>콘텐츠</Text>
      </VStack>,
    );
    const vstack = screen.getByTestId('vstack');

    expect(vstack.props.className).toContain('items-start');
  });

  it('gap prop을 적용해야 한다', async () => {
    await render(
      <VStack testID="vstack" gap={16}>
        <Text>콘텐츠</Text>
      </VStack>,
    );
    const vstack = screen.getByTestId('vstack');

    expect(vstack.props.style).toEqual([{ gap: 16 }, undefined]);
  });

  it('wrap prop을 적용해야 한다', async () => {
    await render(
      <VStack testID="vstack" wrap="wrap">
        <Text>콘텐츠</Text>
      </VStack>,
    );
    const vstack = screen.getByTestId('vstack');

    expect(vstack.props.className).toContain('flex-wrap');
  });

  it('className을 병합해야 한다', async () => {
    await render(
      <VStack testID="vstack" className="p-4">
        <Text>콘텐츠</Text>
      </VStack>,
    );
    const vstack = screen.getByTestId('vstack');

    expect(vstack.props.className).toContain('flex-col');
    expect(vstack.props.className).toContain('p-4');
  });

  it('style prop을 적용해야 한다', async () => {
    await render(
      <VStack testID="vstack" style={{ backgroundColor: 'green' }}>
        <Text>콘텐츠</Text>
      </VStack>,
    );
    const vstack = screen.getByTestId('vstack');

    expect(vstack.props.style).toContainEqual({ backgroundColor: 'green' });
  });

  it('여러 자식 요소를 수직으로 렌더링해야 한다', async () => {
    await render(
      <VStack testID="vstack">
        <VStack testID="child1">
          <Text>첫 번째</Text>
        </VStack>
        <VStack testID="child2">
          <Text>두 번째</Text>
        </VStack>
      </VStack>,
    );

    expect(screen.getByTestId('child1')).toBeTruthy();
    expect(screen.getByTestId('child2')).toBeTruthy();
  });
});
