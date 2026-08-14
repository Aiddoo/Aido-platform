import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { Box } from './Box';

describe('Box 컴포넌트', () => {
  it('children을 렌더링해야 한다', async () => {
    await render(
      <Box testID="parent">
        <Box testID="child">
          <Text>콘텐츠</Text>
        </Box>
      </Box>,
    );

    expect(screen.getByTestId('child')).toBeTruthy();
  });

  it('className을 적용해야 한다', async () => {
    await render(
      <Box testID="box" className="p-4 bg-white">
        <Text>콘텐츠</Text>
      </Box>,
    );
    const box = screen.getByTestId('box');

    expect(box.props.className).toBe('p-4 bg-white');
  });

  it('style prop을 적용해야 한다', async () => {
    await render(
      <Box testID="box" style={{ backgroundColor: 'red' }}>
        <Text>콘텐츠</Text>
      </Box>,
    );
    const box = screen.getByTestId('box');

    expect(box.props.style).toContainEqual({ backgroundColor: 'red' });
  });

  it('testID를 전달해야 한다', async () => {
    await render(
      <Box testID="custom-box">
        <Text>콘텐츠</Text>
      </Box>,
    );

    expect(screen.getByTestId('custom-box')).toBeTruthy();
  });

  it('className과 style을 함께 적용해야 한다', async () => {
    await render(
      <Box testID="box" className="m-2" style={{ padding: 10 }}>
        <Text>콘텐츠</Text>
      </Box>,
    );
    const box = screen.getByTestId('box');

    expect(box.props.className).toBe('m-2');
    expect(box.props.style).toContainEqual({ padding: 10 });
  });

  it('spacing props 미지정 시 undefined 키를 style로 전달하지 않아야 한다', async () => {
    await render(
      <Box testID="box" className="flex-1 py-2">
        <Text>콘텐츠</Text>
      </Box>,
    );
    const box = screen.getByTestId('box');
    const flattened = Object.assign({}, ...[box.props.style].flat().filter(Boolean));

    expect(flattened).not.toHaveProperty('flex');
    expect(flattened).not.toHaveProperty('paddingVertical');
  });

  it('여러 자식 요소를 렌더링해야 한다', async () => {
    await render(
      <Box>
        <Box testID="child1">
          <Text>첫 번째</Text>
        </Box>
        <Box testID="child2">
          <Text>두 번째</Text>
        </Box>
      </Box>,
    );

    expect(screen.getByTestId('child1')).toBeTruthy();
    expect(screen.getByTestId('child2')).toBeTruthy();
  });
});
