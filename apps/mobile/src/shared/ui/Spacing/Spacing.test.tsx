import { render, screen } from '@testing-library/react-native';
import { Spacing } from './Spacing';

describe('Spacing 컴포넌트', () => {
  it('기본적으로 vertical 방향의 높이를 적용해야 한다', () => {
    render(<Spacing testID="spacing" size={12} />);

    const spacing = screen.getByTestId('spacing');
    expect(spacing.props.style).toContainEqual({ height: 12 });
  });

  it('direction=horizontal일 때 너비를 적용해야 한다', () => {
    render(<Spacing testID="spacing" size={8} direction="horizontal" />);

    const spacing = screen.getByTestId('spacing');
    expect(spacing.props.style).toContainEqual({ width: 8 });
  });
});
