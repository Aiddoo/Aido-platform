import { useSpeechRecognizer } from '@src/bootstrap/providers/di-context';
import type { SpeechErrorCode } from '@src/core/ports/speech-recognizer';
import { useLocaleContext } from '@src/shared/hooks/use-locale-context';
import { tDynamic } from '@src/shared/i18n';
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';
import { noop } from 'es-toolkit';
import { useEffect, useRef, useState } from 'react';
import { match } from 'ts-pattern';

import { getRecognizerStartOptions } from '../utils/speech-context';
import { useEnsureMicrophonePermission } from './use-ensure-microphone-permission';
import { useSpeechEvent } from './use-speech-event';

interface UseDictationOptions {
  /** 인식 중 글자가 바뀔 때마다 지금까지 들은 문장 전체를 준다 */
  onResult: (transcript: string) => void;
  /** 오류 없이 듣기가 끝났을 때만 부른다 */
  onEnd?: () => void;
}

function getSpeechErrorMessage(code: SpeechErrorCode) {
  return tDynamic('common', `speechErrors.${code}`, tDynamic('common', 'speechErrors.unknown'));
}

/** 인식기 이벤트는 앱 전체에 하나라 이 훅이 시작한 세션만 받고, 화면이 내려가면 듣던 세션을 끊는다 */
export function useDictation({ onResult, onEnd }: UseDictationOptions) {
  const speechRecognizer = useSpeechRecognizer();
  const ensureMicrophonePermission = useEnsureMicrophonePermission();
  const toast = useAppToast();
  const { speechLocale } = useLocaleContext();
  const [isListening, setIsListening] = useState(false);
  const isMountedRef = useRef(false);
  const isSessionOwnerRef = useRef(false);
  const hasFailedRef = useRef(false);
  const isStopRequestedRef = useRef(false);
  // 시작을 요청한 뒤 인식기의 시작·오류·끝 이벤트가 오기 전까지다. 그 사이에 다시 누르면 인식기가 두 번 시작된다
  const isStartingRef = useRef(false);

  useSpeechEvent((event) => {
    if (!isSessionOwnerRef.current) {
      return;
    }
    match(event)
      .with({ type: 'start' }, () => {
        isStartingRef.current = false;
        setIsListening(true);
      })
      .with({ type: 'result' }, ({ transcript }) => {
        if (transcript.length > 0) {
          onResult(transcript);
        }
      })
      .with({ type: 'error' }, ({ code }) => {
        isStartingRef.current = false;
        // Android 인식기는 stop 뒤에 마지막 결과 대신 client를 줄 수 있다. 내가 멈춘 것이라 실패가 아니다
        if (code === 'client' && isStopRequestedRef.current) {
          return;
        }
        if (!hasFailedRef.current) {
          hasFailedRef.current = true;
          toast.error(getSpeechErrorMessage(code));
        }
        setIsListening(false);
      })
      .with({ type: 'end' }, () => {
        isStartingRef.current = false;
        isSessionOwnerRef.current = false;
        setIsListening(false);
        if (!hasFailedRef.current) {
          onEnd?.();
        }
      })
      .with(
        { type: 'volume' },
        { type: 'no-match' },
        { type: 'recording-started' },
        { type: 'recording-saved' },
        noop,
      )
      .exhaustive();
  });

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      if (isSessionOwnerRef.current) {
        isSessionOwnerRef.current = false;
        speechRecognizer.abort();
      }
    };
  }, [speechRecognizer]);

  const start = async () => {
    if (isStartingRef.current) {
      return;
    }
    isStartingRef.current = true;
    hasFailedRef.current = false;
    isStopRequestedRef.current = false;
    try {
      const locale = speechLocale;
      const isGranted = await ensureMicrophonePermission('dictation', locale);
      if (!isGranted || !isMountedRef.current) {
        isStartingRef.current = false;
        return;
      }
      isSessionOwnerRef.current = true;
      speechRecognizer.start(
        getRecognizerStartOptions({
          locale,
          mode: 'dictation',
          hintWords: [],
          isOnDevice: false,
          recordingDirectory: null,
        }),
      );
    } catch {
      isStartingRef.current = false;
      isSessionOwnerRef.current = false;
      toast.error(getSpeechErrorMessage('unknown'));
    }
  };

  const stop = () => {
    isStopRequestedRef.current = true;
    speechRecognizer.stop();
  };

  return { isListening, start, stop };
}
