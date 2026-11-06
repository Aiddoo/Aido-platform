import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';

import { expoSpeechRecognizerGateway } from './expo-speech-recognizer.gateway';

jest.mock('expo-speech-recognition', () => ({
  ExpoSpeechRecognitionModule: {
    supportsRecording: jest.fn(() => true),
    supportsOnDeviceRecognition: jest.fn(() => true),
    isRecognitionAvailable: jest.fn(() => true),
    getSupportedLocales: jest.fn(),
  },
}));

const nativeModule = jest.mocked(ExpoSpeechRecognitionModule);

describe('expoSpeechRecognizerGateway (Android)', () => {
  test('설치된 언어 모델로 기기 인식을 판단하고 없으면 받기를 제안한다', async () => {
    // Given
    nativeModule.getSupportedLocales.mockResolvedValueOnce({
      locales: ['ko-KR', 'en-US'],
      installedLocales: ['en-US'],
    });

    // When
    const capabilities = await expoSpeechRecognizerGateway.getCapabilities('ko-KR', 'note');

    // Then
    expect(capabilities.canRecognizeOnDevice).toBe(false);
    expect(capabilities.canDownloadOnDeviceModel).toBe(true);
  });
});
