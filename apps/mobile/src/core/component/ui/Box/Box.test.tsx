import { render, screen } from '@testing-library/react-native';
import { Box } from './Box';

describe('Box 컴포넌트', () => {
  it('children을 렌더링해야 한다', () => {
    render(
      <Box testID="parent">
        <Box testID="child">콘텐츠</Box>
      </Box>,
    );

    expect(screen.getByTestId('child')).toBeTruthy();
  });

  it('className을 적용해야 한다', () => {
    render(
      <Box testID="box" className="p-4 bg-white">
        콘텐츠
      </Box>,
    );
    const box = screen.getByTestId('box');

    expect(box.props.className).toBe('p-4 bg-white');
  });

  it('style prop을 적용해야 한다', () => {
    render(
      <Box testID="box" style={{ backgroundColor: 'red' }}>
        콘텐츠
      </Box>,
    );
    const box = screen.getByTestId('box');

    expect(box.props.style).toEqual({ backgroundColor: 'red' });
  });

  it('testID를 전달해야 한다', () => {
    render(<Box testID="custom-box">콘텐츠</Box>);

    expect(screen.getByTestId('custom-box')).toBeTruthy();
  });

  it('className과 style을 함께 적용해야 한다', () => {
    render(
      <Box testID="box" className="m-2" style={{ padding: 10 }}>
        콘텐츠
      </Box>,
    );
    const box = screen.getByTestId('box');

    expect(box.props.className).toBe('m-2');
    expect(box.props.style).toEqual({ padding: 10 });
  });

  it('여러 자식 요소를 렌더링해야 한다', () => {
    render(
      <Box>
        <Box testID="child1">첫 번째</Box>
        <Box testID="child2">두 번째</Box>
      </Box>,
    );

    expect(screen.getByTestId('child1')).toBeTruthy();
    expect(screen.getByTestId('child2')).toBeTruthy();
  });
});
