import { Platform, type TextInputProps } from 'react-native';

/**
 * 영문 대문자·숫자 코드(친구 태그, 초대 코드) 입력용 자판 설정. 한글 자판 대신 영문 자판을 띄우고
 * (iOS ascii-capable, Android는 추천 단어 없는 visible-password) 자동 고침·추천을 끈다.
 */
export const ASCII_CODE_TEXT_INPUT_PROPS = {
  keyboardType: Platform.select({ ios: 'ascii-capable', android: 'visible-password' }),
  autoCapitalize: 'characters',
  autoCorrect: false,
  autoComplete: 'off',
  spellCheck: false,
} as const satisfies TextInputProps;
