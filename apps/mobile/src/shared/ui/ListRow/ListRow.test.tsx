import { render, screen } from '@testing-library/react-native';
import { View } from 'react-native';
import { ListRow } from './ListRow';
import { listRowIconVariants, listRowSlotVariants, listRowVariants } from './ListRow.variants';

describe('ListRow', () => {
  test('contents를 렌더링한다', () => {
    render(<ListRow contents={<ListRow.Texts top="제목" />} />);

    expect(screen.getByText('제목')).toBeTruthy();
  });

  test('left, contents, right 영역을 모두 렌더링한다', () => {
    render(
      <ListRow
        left={<View testID="left" />}
        contents={<ListRow.Texts top="내용" />}
        right={<View testID="right" />}
      />,
    );

    expect(screen.getByTestId('left')).toBeTruthy();
    expect(screen.getByText('내용')).toBeTruthy();
    expect(screen.getByTestId('right')).toBeTruthy();
  });

  test('left 없이 contents와 right만 렌더링할 수 있다', () => {
    render(<ListRow contents={<ListRow.Texts top="내용" />} right={<View testID="right" />} />);

    expect(screen.getByText('내용')).toBeTruthy();
    expect(screen.getByTestId('right')).toBeTruthy();
  });
});

describe('ListRow.Texts', () => {
  test('1Row 타입은 top만 렌더링한다', () => {
    render(<ListRow.Texts type="1Row" top="제목" middle="설명" bottom="추가" />);

    expect(screen.getByText('제목')).toBeTruthy();
    expect(screen.queryByText('설명')).toBeNull();
    expect(screen.queryByText('추가')).toBeNull();
  });

  test('2Row 타입은 top과 middle을 렌더링한다', () => {
    render(<ListRow.Texts type="2Row" top="제목" middle="설명" bottom="추가" />);

    expect(screen.getByText('제목')).toBeTruthy();
    expect(screen.getByText('설명')).toBeTruthy();
    expect(screen.queryByText('추가')).toBeNull();
  });

  test('3Row 타입은 top, middle, bottom 모두 렌더링한다', () => {
    render(<ListRow.Texts type="3Row" top="제목" middle="설명" bottom="추가" />);

    expect(screen.getByText('제목')).toBeTruthy();
    expect(screen.getByText('설명')).toBeTruthy();
    expect(screen.getByText('추가')).toBeTruthy();
  });
});

describe('ListRow.Icon', () => {
  test('children을 렌더링한다', () => {
    render(
      <ListRow.Icon>
        <View testID="icon" />
      </ListRow.Icon>,
    );

    expect(screen.getByTestId('icon')).toBeTruthy();
  });
});

describe('listRowVariants', () => {
  test('verticalPadding에 따라 패딩이 달라진다', () => {
    expect(listRowVariants({ verticalPadding: 'small' })).toContain('py-1');
    expect(listRowVariants({ verticalPadding: 'medium' })).toContain('py-2');
    expect(listRowVariants({ verticalPadding: 'large' })).toContain('py-4');
    expect(listRowVariants({ verticalPadding: 'xlarge' })).toContain('py-5');
  });

  test('horizontalPadding에 따라 패딩이 달라진다', () => {
    expect(listRowVariants({ horizontalPadding: 'none' })).not.toContain('px-');
    expect(listRowVariants({ horizontalPadding: 'small' })).toContain('px-2');
    expect(listRowVariants({ horizontalPadding: 'medium' })).toContain('px-4');
  });

  test('border=indented는 하단 테두리를 적용한다', () => {
    expect(listRowVariants({ border: 'indented' })).toContain('border-b');
  });

  test('비활성화 상태에서는 투명도가 낮아진다', () => {
    expect(listRowVariants({ disabled: true })).toContain('opacity-40');
  });
});

describe('listRowSlotVariants', () => {
  test('alignment에 따라 정렬이 달라진다', () => {
    expect(listRowSlotVariants({ alignment: 'top' })).toContain('items-start');
    expect(listRowSlotVariants({ alignment: 'center' })).toContain('items-center');
  });
});

describe('listRowIconVariants', () => {
  test('size에 따라 크기가 달라진다', () => {
    expect(listRowIconVariants({ size: 'small' })).toContain('w-6');
    expect(listRowIconVariants({ size: 'medium' })).toContain('w-10');
    expect(listRowIconVariants({ size: 'large' })).toContain('w-12');
  });
});
