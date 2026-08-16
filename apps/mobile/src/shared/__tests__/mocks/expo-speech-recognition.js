/**
 * expo-speech-recognition은 공식 jest mock을 내주지 않고, import 시점에 네이티브
 * 모듈을 붙잡아 그대로 터진다. 앱이 쓰는 표면이 좁아 그만큼만 채운다.
 */
module.exports = {
  ExpoSpeechRecognitionModule: {
    start: jest.fn(),
    stop: jest.fn(),
    getPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true })),
    requestPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true })),
  },
  useSpeechRecognitionEvent: jest.fn(),
};
