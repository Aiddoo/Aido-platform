import type { ExpoSpeechRecognitionErrorCode } from 'expo-speech-recognition';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { useCallback } from 'react';

import { useMicrophonePermission } from './useMicrophonePermission';
import { useSpeechRecognitionEvents } from './useSpeechRecognitionEvents';

export interface UseSpeechRecognitionOptions {
  /** 음성 인식 언어 (기본값: 'ko-KR') */
  lang?: string;
  /** 중간 결과 반환 여부 (기본값: true) */
  interimResults?: boolean;
  /** 연속 인식 모드 (기본값: false) */
  continuous?: boolean;
  /** 인식 결과 콜백 */
  onResult?: (transcript: string) => void;
  /** 에러 콜백 (한국어 메시지, 한 번만 호출됨) */
  onError?: (message: string) => void;
}

export interface UseSpeechRecognitionReturn {
  /** 현재 음성 인식 중인지 여부 */
  isRecognizing: boolean;
  /** 음성 인식 시작 */
  start: () => Promise<void>;
  /** 음성 인식 중지 */
  stop: () => void;
}

/**
 * 음성 인식 기능을 제공하는 Hook (Facade)
 *
 * 내부적으로 세 가지 책임을 분리된 모듈로 관리합니다:
 * - 에러 메시지 변환: `SPEECH_RECOGNITION_ERROR_MESSAGES`
 * - 마이크 권한 관리: `useMicrophonePermission`
 * - 이벤트 처리: `useSpeechRecognitionEvents`
 *
 * @example
 * ```tsx
 * const { isRecognizing, start, stop } = useSpeechRecognition({
 *   onResult: (text) => setInputText(text),
 *   onError: (message) => toast.show({ label: message }),
 * });
 *
 * const handleMicPress = () => {
 *   if (isRecognizing) {
 *     stop();
 *   } else {
 *     start();
 *   }
 * };
 * ```
 */
export const useSpeechRecognition = (
  options: UseSpeechRecognitionOptions = {},
): UseSpeechRecognitionReturn => {
  const { lang = 'ko-KR', interimResults = true, continuous = false, onResult, onError } = options;

  // 에러 코드를 한국어 메시지로 변환하여 콜백 호출
  const handleError = useCallback(
    (errorCode: ExpoSpeechRecognitionErrorCode) => {
      const koreanMessage = SPEECH_RECOGNITION_ERROR_MESSAGES[errorCode];
      onError?.(koreanMessage);
    },
    [onError],
  );

  // 이벤트 처리 (isRecognizing 상태 관리)
  const { isRecognizing, resetErrorFlag } = useSpeechRecognitionEvents({
    onResult,
    onError: handleError,
  });

  // 권한 관리
  const { requestPermissionAndExecute } = useMicrophonePermission(onError);

  // 음성 인식 시작
  const startRecognition = useCallback(() => {
    ExpoSpeechRecognitionModule.start({ lang, interimResults, continuous });
  }, [lang, interimResults, continuous]);

  const start = useCallback(async () => {
    resetErrorFlag();
    await requestPermissionAndExecute(startRecognition);
  }, [resetErrorFlag, requestPermissionAndExecute, startRecognition]);

  // 음성 인식 중지
  const stop = useCallback(() => {
    ExpoSpeechRecognitionModule.stop();
  }, []);

  return {
    isRecognizing,
    start,
    stop,
  };
};

/**
 * 음성 인식 에러 코드별 한국어 메시지 매핑
 */
export const SPEECH_RECOGNITION_ERROR_MESSAGES: Record<ExpoSpeechRecognitionErrorCode, string> = {
  'no-speech': '음성이 감지되지 않았어요. 다시 말씀해주세요.',
  'speech-timeout': '음성 입력 시간이 초과되었어요. 다시 시도해주세요.',
  aborted: '음성 인식이 취소되었어요.',
  'not-allowed': '마이크 권한이 필요해요. 설정에서 권한을 허용해주세요.',
  'service-not-allowed': '음성 인식 서비스를 사용할 수 없어요.',
  busy: '음성 인식이 이미 진행 중이에요. 잠시 후 다시 시도해주세요.',
  'audio-capture': '마이크 연결을 확인해주세요.',
  network: '인터넷 연결을 확인해주세요.',
  interrupted: '다른 앱에서 마이크를 사용 중이에요. 잠시 후 다시 시도해주세요.',
  'language-not-supported': '지원하지 않는 언어예요.',
  'bad-grammar': '음성 인식 설정에 문제가 있어요.',
  client: '음성 인식 중 문제가 발생했어요. 다시 시도해주세요.',
  unknown: '알 수 없는 오류가 발생했어요. 다시 시도해주세요.',
};
