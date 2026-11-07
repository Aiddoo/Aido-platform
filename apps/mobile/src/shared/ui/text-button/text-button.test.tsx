import { renderUi } from '@src/shared/__tests__/render-ui';
import { screen } from '@testing-library/react-native';

import { TextButton } from './text-button';
import { textButtonVariants } from './text-button.variants';

describe('TextButton', () => {
  test('children을 렌더링한다', async () => {
    await renderUi(<TextButton>텍스트</TextButton>);

    expect(screen.getByText('텍스트')).toBeTruthy();
  });

  test('variant=arrow일 때만 화살표 아이콘을 표시한다', async () => {
    const { rerender } = await renderUi(<TextButton variant="arrow">더보기</TextButton>);
    expect(screen.getByTestId('text-button-arrow')).toBeTruthy();

    await rerender(<TextButton variant="clear">더보기</TextButton>);
    expect(screen.queryByTestId('text-button-arrow')).toBeNull();
  });
});

describe('textButtonVariants', () => {
  test('size에 따라 폰트 크기가 달라진다', () => {
    expect(textButtonVariants({ size: 'xsmall' })).toContain('text-e2');
    expect(textButtonVariants({ size: 'xlarge' })).toContain('text-b2');
  });

  test('underline variant는 밑줄을 적용한다', () => {
    expect(textButtonVariants({ variant: 'underline' })).toContain('underline');
  });

  test('비활성화 상태에서는 heroui 기본보다 낮은 투명도를 쓴다', () => {
    expect(textButtonVariants({})).toContain('disabled:opacity-40');
  });
});
