import { render, screen } from '@testing-library/react-native';
import { Text } from '../Text';
import { shadeClasses, textVariants } from '../Text.variants';
import { H1, H2, H3, H4 } from '../Typography';

describe('textVariants 함수', () => {
  it('기본 클래스를 포함해야 한다', () => {
    const classes = textVariants({});
    expect(classes).toContain('font-normal');
    expect(classes).toContain('text-foreground');
    expect(classes).toContain('text-b3');
    expect(classes).toContain('text-left');
  });

  it('tone에 따른 색상 클래스를 반환해야 한다', () => {
    expect(textVariants({ tone: 'neutral' })).toContain('text-foreground');
    expect(textVariants({ tone: 'brand' })).toContain('text-main');
    expect(textVariants({ tone: 'danger' })).toContain('text-error');
    expect(textVariants({ tone: 'warning' })).toContain('text-warning');
    expect(textVariants({ tone: 'success' })).toContain('text-success');
    expect(textVariants({ tone: 'info' })).toContain('text-info');
  });

  it('여러 variant 조합 시 모든 클래스를 포함해야 한다', () => {
    const classes = textVariants({
      size: 'h1',
      weight: 'bold',
      tone: 'danger',
      align: 'center',
    });
    expect(classes).toContain('text-h1');
    expect(classes).toContain('font-bold');
    expect(classes).toContain('text-error');
    expect(classes).toContain('text-center');
  });

  it('strikethrough 클래스를 적용해야 한다', () => {
    const classes = textVariants({ strikethrough: true });
    expect(classes).toContain('line-through');
  });

  it('underline 클래스를 적용해야 한다', () => {
    const classes = textVariants({ underline: true });
    expect(classes).toContain('underline');
  });
});

describe('shadeClasses 매핑', () => {
  it('1-10 범위의 shade 클래스를 제공해야 한다', () => {
    for (let i = 1; i <= 10; i++) {
      expect(shadeClasses[i]).toBe(`text-gray-${i}`);
    }
  });
});

describe('Text 컴포넌트', () => {
  it('기본 스타일을 적용해야 한다', () => {
    render(<Text>텍스트</Text>);
    const text = screen.getByText('텍스트');

    expect(text.props.className).toContain('font-normal');
    expect(text.props.className).toContain('text-foreground');
    expect(text.props.className).toContain('text-b3');
  });

  it('tone과 className을 병합해야 한다', () => {
    render(
      <Text tone="brand" className="mt-4">
        테스트
      </Text>,
    );
    const text = screen.getByText('테스트');

    expect(text.props.className).toContain('text-main');
    expect(text.props.className).toContain('mt-4');
  });

  it('neutral tone에서 shade 클래스를 적용해야 한다', () => {
    render(
      <Text tone="neutral" shade={8}>
        테스트
      </Text>,
    );
    const text = screen.getByText('테스트');

    expect(text.props.className).toContain('text-gray-8');
  });

  it('non-neutral tone에서는 shade를 무시해야 한다', () => {
    render(
      <Text tone="brand" shade={8}>
        테스트
      </Text>,
    );
    const text = screen.getByText('테스트');

    expect(text.props.className).toContain('text-main');
    expect(text.props.className).not.toContain('text-gray-8');
  });

  it('weight prop을 적용해야 한다', () => {
    render(<Text weight="bold">텍스트</Text>);
    const text = screen.getByText('텍스트');

    expect(text.props.className).toContain('font-bold');
  });

  it('size prop을 적용해야 한다', () => {
    render(<Text size="h1">텍스트</Text>);
    const text = screen.getByText('텍스트');

    expect(text.props.className).toContain('text-h1');
  });

  it('align prop을 적용해야 한다', () => {
    render(<Text align="center">텍스트</Text>);
    const text = screen.getByText('텍스트');

    expect(text.props.className).toContain('text-center');
  });

  it('strikethrough prop을 적용해야 한다', () => {
    render(<Text strikethrough>텍스트</Text>);
    const text = screen.getByText('텍스트');

    expect(text.props.className).toContain('line-through');
  });

  it('underline prop을 적용해야 한다', () => {
    render(<Text underline>텍스트</Text>);
    const text = screen.getByText('텍스트');

    expect(text.props.className).toContain('underline');
  });

  it('maxLines prop을 numberOfLines로 전달해야 한다', () => {
    render(<Text maxLines={2}>텍스트</Text>);
    const text = screen.getByText('텍스트');

    expect(text.props.numberOfLines).toBe(2);
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

  it('H2는 accessibilityRole을 header로 설정해야 한다', () => {
    render(<H2>제목</H2>);
    const heading = screen.getByRole('header');
    expect(heading).toBeTruthy();
  });

  it('H3는 accessibilityRole을 header로 설정해야 한다', () => {
    render(<H3>제목</H3>);
    const heading = screen.getByRole('header');
    expect(heading).toBeTruthy();
  });

  it('H4는 accessibilityRole을 header로 설정해야 한다', () => {
    render(<H4>제목</H4>);
    const heading = screen.getByRole('header');
    expect(heading).toBeTruthy();
  });

  it('emphasize prop 사용 시 brand tone을 적용해야 한다', () => {
    render(<H1 emphasize>제목</H1>);
    const heading = screen.getByText('제목');

    expect(heading.props.className).toContain('text-main');
  });

  it('emphasize 없이 기본적으로 neutral shade 10을 적용해야 한다', () => {
    render(<H1>제목</H1>);
    const heading = screen.getByText('제목');

    expect(heading.props.className).toContain('text-gray-10');
  });
});
