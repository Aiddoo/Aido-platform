import type {
  SpeechPermission,
  SpeechCapabilities,
  SpeechEvent,
  SpeechRecognizer,
} from '@src/core/ports/speech-recognizer';

import { mockMethod } from '../mock-method';

const GRANTED: SpeechPermission = { status: 'granted', canAskAgain: true };
const FULL_CAPABILITIES: SpeechCapabilities = {
  isAvailable: true,
  canRecognizeOnDevice: true,
  canDownloadOnDeviceModel: false,
  canSaveRecording: true,
  canContinue: true,
};

export interface SpeechRecognizerStub extends jest.Mocked<SpeechRecognizer> {
  /** 인식기가 이벤트를 보낸 것처럼 구독자에게 알린다 */
  emit(event: SpeechEvent): void;
  getListenerCount(): number;
}

/** 권한·기능이 모두 있는 기기. 다른 상황은 반환된 jest.fn을 테스트에서 바꾼다 */
export function createSpeechRecognizerStub(): SpeechRecognizerStub {
  const listeners = new Set<(event: SpeechEvent) => void>();

  return {
    getPermission: jest
      .fn<Promise<SpeechPermission>, Parameters<SpeechRecognizer['getPermission']>>()
      .mockResolvedValue(GRANTED),
    requestPermission: jest
      .fn<Promise<SpeechPermission>, Parameters<SpeechRecognizer['requestPermission']>>()
      .mockResolvedValue(GRANTED),
    getCapabilities: jest
      .fn<Promise<SpeechCapabilities>, Parameters<SpeechRecognizer['getCapabilities']>>()
      .mockResolvedValue(FULL_CAPABILITIES),
    requestOfflineModel: jest
      .fn<
        ReturnType<SpeechRecognizer['requestOfflineModel']>,
        Parameters<SpeechRecognizer['requestOfflineModel']>
      >()
      .mockResolvedValue('unavailable'),
    start: mockMethod<SpeechRecognizer['start']>(),
    stop: mockMethod<SpeechRecognizer['stop']>(),
    abort: mockMethod<SpeechRecognizer['abort']>(),
    subscribe: mockMethod<SpeechRecognizer['subscribe']>(
      (listener: (event: SpeechEvent) => void) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    ),
    emit: (event) => {
      for (const listener of listeners) {
        listener(event);
      }
    },
    getListenerCount: () => listeners.size,
  };
}
