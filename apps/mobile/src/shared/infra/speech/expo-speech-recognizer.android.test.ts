import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';

import { expoSpeechRecognizer } from './expo-speech-recognizer';

jest.mock('expo-speech-recognition', () => ({
  ExpoSpeechRecognitionModule: {
    supportsRecording: jest.fn(() => true),
    supportsOnDeviceRecognition: jest.fn(() => true),
    isRecognitionAvailable: jest.fn(() => true),
    getSupportedLocales: jest.fn(),
  },
}));

const nativeModule = jest.mocked(ExpoSpeechRecognitionModule);

describe('expoSpeechRecognizer (Android)', () => {
  it('설치된 언어 모델로 기기 인식을 판단하고 없으면 받기를 제안한다', async () => {
    // Given
    nativeModule.getSupportedLocales.mockResolvedValueOnce({
      locales: ['ko-KR', 'en-US'],
      installedLocales: ['en-US'],
    });

    // When
    const capabilities = await expoSpeechRecognizer.getCapabilities('note', 'ko-KR');

    // Then
    expect(capabilities.canRecognizeOnDevice).toBe(false);
    expect(capabilities.canDownloadOnDeviceModel).toBe(true);
  });
});
