import { render, screen } from '@testing-library/react-native';
import { Text } from '../Text';
import { textVariants } from '../Text.variants';
import { H1 } from '../Typography';

describe('textVariants 함수', () => {
  it('커스텀 색상 클래스를 포함해야 한다', () => {
    const classes = textVariants({ color: 'gray-8', size: 'b1' });
    expect(classes).toContain('text-gray-8');
    expect(classes).toContain('text-b1');
  });

  it('여러 variant 조합 시 모든 클래스를 포함해야 한다', () => {
    const classes = textVariants({
      size: 'h1',
      weight: 'bold',
      color: 'main',
    });
    expect(classes).toContain('text-h1');
    expect(classes).toContain('font-bold');
    expect(classes).toContain('text-main');
  });
});

describe('Text 컴포넌트', () => {
  it('variant 클래스와 className을 병합해야 한다', () => {
    render(
      <Text color="main" className="mt-4">
        테스트
      </Text>,
    );
    const text = screen.getByText('테스트');

    expect(text.props.className).toContain('text-main');
    expect(text.props.className).toContain('mt-4');
  });
});

describe('Typography 컴포넌트', () => {
  it('H1은 headline prop으로 상단 라벨을 렌더링해야 한다', () => {
    render(<H1 headline="STEP 1">Title</H1>);
    expect(screen.getByText('STEP 1')).toBeTruthy();
    expect(screen.getByText('Title')).toBeTruthy();
  });

  it('H1은 accessibilityRole을 header로 설정해야 한다', () => {
    render(<H1>제목</H1>);
    const heading = screen.getByRole('header');
    expect(heading).toBeTruthy();
  });
});
