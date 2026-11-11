import { renderScreen } from '@src/testing/render';
import { screen } from '@testing-library/react-native';

import { Button } from './button';

describe('Button', () => {
  it.each([
    { name: 'isDisabled', props: { isDisabled: true } },
    { name: 'isLoading', props: { isLoading: true } },
  ])('$name이면 버튼을 비활성화한다', async ({ props }) => {
    // When
    await renderScreen(
      <Button testID="button" {...props}>
        버튼
      </Button>,
    );

    // Then
    expect(screen.getByTestId('button').props.accessibilityState.disabled).toBe(true);
  });

  it.each(['full', 'block'] as const)(
    '%s 버튼의 글자 칸은 버튼 폭을 모두 쓴다. 글자 폭에 꼭 맞추면 Android 큰 글꼴에서 마지막 글자가 다음 줄로 넘어가 가려진다',
    async (display) => {
      // When
      await renderScreen(<Button display={display}>할 일 3개 추가</Button>);

      // Then
      expect(screen.getByText('할 일 3개 추가').props.className).toEqual(
        expect.stringMatching(/(^| )flex-1( |$)/),
      );
      expect(screen.getByText('할 일 3개 추가').props.className).toContain('text-center');
    },
  );

  it('inline 버튼은 글자 폭만큼만 차지한다', async () => {
    // When
    await renderScreen(<Button display="inline">복사</Button>);

    // Then
    expect(screen.getByText('복사').props.className).not.toMatch(/(^| )flex-1( |$)/);
  });
});
