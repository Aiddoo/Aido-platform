import { render, screen } from '@testing-library/react-native';
import { View } from 'react-native';
import { ListRow } from './ListRow';

describe('ListRow', () => {
  describe('기본 렌더링', () => {
    it('should render contents when provided', () => {
      // Given: ListRow에 contents가 주어졌을 때
      const contentsText = '제목';

      // When: ListRow를 렌더링하면
      render(<ListRow contents={<ListRow.Texts type="1RowTypeA" top={contentsText} />} />);

      // Then: contents가 화면에 표시된다
      expect(screen.getByText(contentsText)).toBeTruthy();
    });

    it('should render left, contents, and right sections', () => {
      // Given: left, contents, right 영역이 모두 주어졌을 때
      const leftTestId = 'left';
      const contentsText = '내용';
      const rightTestId = 'right';

      // When: 모든 영역을 포함한 ListRow를 렌더링하면
      render(
        <ListRow
          left={<View testID={leftTestId} />}
          contents={<ListRow.Texts type="1RowTypeA" top={contentsText} />}
          right={<View testID={rightTestId} />}
        />,
      );

      // Then: 모든 영역이 화면에 표시된다
      expect(screen.getByTestId(leftTestId)).toBeTruthy();
      expect(screen.getByText(contentsText)).toBeTruthy();
      expect(screen.getByTestId(rightTestId)).toBeTruthy();
    });

    it('should render without left section', () => {
      // Given: left 없이 contents와 right만 주어졌을 때
      const contentsText = '내용';
      const rightTestId = 'right';

      // When: left 없이 ListRow를 렌더링하면
      render(
        <ListRow
          contents={<ListRow.Texts type="1RowTypeA" top={contentsText} />}
          right={<View testID={rightTestId} />}
        />,
      );

      // Then: contents와 right만 화면에 표시된다
      expect(screen.getByText(contentsText)).toBeTruthy();
      expect(screen.getByTestId(rightTestId)).toBeTruthy();
    });
  });

  describe('ListRow.Texts', () => {
    it('should render only top text for 1RowTypeA', () => {
      // Given: 1RowTypeA 타입으로 top만 주어졌을 때
      const topText = '제목';

      // When: ListRow.Texts를 렌더링하면
      render(<ListRow.Texts type="1RowTypeA" top={topText} />);

      // Then: top만 화면에 표시된다
      expect(screen.getByText(topText)).toBeTruthy();
    });

    it('should render top and bottom for 2RowTypeA', () => {
      // Given: 2RowTypeA 타입으로 top과 bottom이 주어졌을 때
      const topText = '제목';
      const bottomText = '부제목';

      // When: ListRow.Texts를 렌더링하면
      render(<ListRow.Texts type="2RowTypeA" top={topText} bottom={bottomText} />);

      // Then: top과 bottom이 화면에 표시된다
      expect(screen.getByText(topText)).toBeTruthy();
      expect(screen.getByText(bottomText)).toBeTruthy();
    });

    it('should render top, middle, and bottom for 3RowTypeA', () => {
      // Given: 3RowTypeA 타입으로 top, middle, bottom이 모두 주어졌을 때
      const topText = '제목';
      const middleText = '설명';
      const bottomText = '추가정보';

      // When: ListRow.Texts를 렌더링하면
      render(
        <ListRow.Texts type="3RowTypeA" top={topText} middle={middleText} bottom={bottomText} />,
      );

      // Then: 모든 텍스트가 화면에 표시된다
      expect(screen.getByText(topText)).toBeTruthy();
      expect(screen.getByText(middleText)).toBeTruthy();
      expect(screen.getByText(bottomText)).toBeTruthy();
    });
  });

  describe('ListRow.Image', () => {
    it('should render image with default size', () => {
      // Given: 기본 설정으로 이미지가 주어졌을 때
      const imageSource = { uri: 'https://example.com/image.jpg' };
      const testId = 'list-row-image';

      // When: ListRow.Image를 렌더링하면
      render(<ListRow.Image source={imageSource} testID={testId} />);

      // Then: 이미지가 화면에 표시된다
      expect(screen.getByTestId(testId)).toBeTruthy();
    });
  });
});
