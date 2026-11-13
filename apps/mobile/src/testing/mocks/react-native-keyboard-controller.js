/**
 * react-native-keyboard-controller 공식 jest mock + 빠진 것 한 가지.
 *
 * 실물 `useKeyboardContext()`는 `setEnabled`를 함께 내주지만, 공식 mock은 그 함수를
 * `useKeyboardController`에만 두었다. `KeyboardBottomSheet`는 시트가 열려 있는 동안
 * 키보드 제어를 끄려고 컨텍스트 쪽 `setEnabled`를 쓴다 — 그래서 이 한 칸만 메운다.
 *
 * 나머지는 손대지 않는다. 벤더가 mock을 고치면 이 파일에서 이 줄만 지우면 된다.
 */
const official = require('react-native-keyboard-controller/jest');

module.exports = {
  ...official,
  useKeyboardContext: jest.fn(() => ({
    ...official.useKeyboardContext(),
    setEnabled: jest.fn(),
  })),
};
