import { VERIFICATION_CODE } from '@aido/api/vocabulary';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { BackHandler } from 'react-native';

type BackListener = Parameters<typeof BackHandler.addEventListener>[1];

/** 단계 화면의 Android 뒤로 가기. 화면을 그리기 전에 불러 구독을 모은다. spy는 설정의 restoreMocks가 되돌린다 */
export function givenAndroidBack() {
  const listeners = new Set<BackListener>();
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_, listener) => {
    listeners.add(listener);
    return { remove: () => listeners.delete(listener) };
  });
  return {
    press: () =>
      act(async () => [...listeners].at(-1)?.({ type: 'hardwareBackPress', timeStamp: 0 })),
  };
}

/** 인증 코드 칸은 글자 수를 접근성 이름에 싣는 숨은 입력 하나다. 칸이 다 차면 바로 확인한다 */
export async function typeVerificationCode(code: string) {
  await fireEvent.changeText(
    await screen.findByLabelText(`One-time passcode input, ${VERIFICATION_CODE.LENGTH} digits`),
    code,
  );
}
