import type { ExpoSpeechRecognitionErrorCode } from 'expo-speech-recognition';
import { useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useRef, useState } from 'react';

interface UseSpeechRecognitionEventsOptions {
  /** 인식 결과 콜백 */
  onResult?: (transcript: string) => void;
  /** 에러 콜백 (에러 코드 전달) */
  onError?: (errorCode: ExpoSpeechRecognitionErrorCode) => void;
}

interface UseSpeechRecognitionEventsReturn {
  /** 현재 음성 인식 중인지 여부 */
  isRecognizing: boolean;
  /** 에러 발생 플래그 리셋 (음성 인식 시작 전 호출) */
  resetErrorFlag: () => void;
}

/**
 * 음성 인식 이벤트를 처리하는 Hook
 *
 * expo-speech-recognition의 이벤트를 구독하고 상태를 관리합니다.
 *
 * @param options - 이벤트 콜백 옵션
 *
 * @example
 * ```tsx
 * const { isRecognizing, resetErrorFlag } = useSpeechRecognitionEvents({
 *   onResult: (transcript) => setInputText(transcript),
 *   onError: (errorCode) => {
 *     const message = SPEECH_RECOGNITION_ERROR_MESSAGES[errorCode];
 *     toast.show({ label: message });
 *   },
 * });
 * ```
 */
export const useSpeechRecognitionEvents = (
  options: UseSpeechRecognitionEventsOptions = {},
): UseSpeechRecognitionEventsReturn => {
  const { onResult, onError } = options;

  const [isRecognizing, setIsRecognizing] = useState(false);
  // 에러가 한 번만 호출되도록 ref로 추적
  const hasErrorFiredRef = useRef(false);

  useSpeechRecognitionEvent('start', () => {
    setIsRecognizing(true);
    hasErrorFiredRef.current = false;
  });

  useSpeechRecognitionEvent('end', () => {
    setIsRecognizing(false);
  });

  useSpeechRecognitionEvent('result', (event) => {
    const result = event.results[0]?.transcript;
    if (result) {
      onResult?.(result);
    }
  });

  useSpeechRecognitionEvent('error', (event) => {
    // 에러는 한 번만 콜백 호출
    if (!hasErrorFiredRef.current) {
      hasErrorFiredRef.current = true;
      onError?.(event.error);
    }
    setIsRecognizing(false);
  });

  const resetErrorFlag = () => {
    hasErrorFiredRef.current = false;
  };

  return {
    isRecognizing,
    resetErrorFlag,
  };
};
