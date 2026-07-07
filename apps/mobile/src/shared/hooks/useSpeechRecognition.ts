import { i18n, tDynamic } from '@src/shared/i18n';
import type { ExpoSpeechRecognitionErrorCode } from 'expo-speech-recognition';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { useCallback } from 'react';

import { useMicrophonePermission } from './useMicrophonePermission';
import { useSpeechRecognitionEvents } from './useSpeechRecognitionEvents';

export interface UseSpeechRecognitionOptions {
  /** 음성 인식 언어 (기본값: 앱 표시 언어 — ko-KR/en-US) */
  lang?: string;
  /** 중간 결과 반환 여부 (기본값: true) */
  interimResults?: boolean;
  /** 연속 인식 모드 (기본값: false) */
  continuous?: boolean;
  /** 인식 결과 콜백 */
  onResult?: (transcript: string) => void;
  /** 음성 인식 정상 종료 콜백 (에러 시 미호출) */
  onEnd?: () => void;
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
 * - 에러 메시지 변환: `getSpeechRecognitionErrorMessage`
 * - 마이크 권한 관리: `useMicrophonePermission`
 * - 이벤트 처리: `useSpeechRecognitionEvents`
 *
 * @example
 * ```tsx
 * const { isRecognizing, start, stop } = useSpeechRecognition({
 *   onResult: (text) => setInputText(text),
 *   onError: (message) => toast.error(message),
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
  const {
    lang = i18n.language === 'en' ? 'en-US' : 'ko-KR',
    interimResults = true,
    continuous = false,
    onResult,
    onEnd,
    onError,
  } = options;

  // 에러 코드를 로케일 메시지로 변환하여 콜백 호출
  const handleError = useCallback(
    (errorCode: ExpoSpeechRecognitionErrorCode) => {
      onError?.(getSpeechRecognitionErrorMessage(errorCode));
    },
    [onError],
  );

  // 이벤트 처리 (isRecognizing 상태 관리)
  const { isRecognizing, resetErrorFlag } = useSpeechRecognitionEvents({
    onResult,
    onEnd,
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

/** 음성 인식 에러 코드 → 로케일 메시지 (common:speechErrors 카탈로그) */
export const getSpeechRecognitionErrorMessage = (code: ExpoSpeechRecognitionErrorCode): string =>
  tDynamic('common', `speechErrors.${code}`, tDynamic('common', 'speechErrors.unknown'));
