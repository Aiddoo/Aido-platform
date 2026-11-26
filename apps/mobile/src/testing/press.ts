import { act, fireEvent } from '@testing-library/react-native';

/**
 * 다시 그리기 전에 같은 요소를 두 번 누른다(`isPending`이 아직 꺼진 같은 프레임). 누름은 응답·다이얼로그의 답이 와야 끝나
 * 기다리지 않고, 두 번 사이에 렌더·마이크로태스크가 끼지 않도록 한 act 안에서 누른다
 */
export async function pressTwiceInSameFrame(element: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    fireEvent.press(element).catch(() => undefined);
    fireEvent.press(element).catch(() => undefined);
  });
}
