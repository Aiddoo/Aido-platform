import { useSpeechRecognizer } from '@src/bootstrap/providers/di-context';
import type { SpeechErrorCode, SpeechEvent } from '@src/core/ports/speech-recognizer';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { tDynamic } from '@src/shared/i18n';
import { useLanguage } from '@src/shared/providers/language-provider';
import { noop } from 'es-toolkit';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { match } from 'ts-pattern';

import { APP_LANGUAGE_SPEECH_LOCALE } from '../constants/voice.constants';
import { useMicrophonePermission } from './use-microphone-permission';

interface UseDictationOptions {
  /** 인식 중 글자가 바뀔 때마다 지금까지 들은 문장 전체를 준다 */
  onResult: (transcript: string) => void;
  /** 오류 없이 듣기가 끝났을 때만 부른다 */
  onEnd?: () => void;
}

function getSpeechErrorMessage(code: SpeechErrorCode) {
  return tDynamic('common', `speechErrors.${code}`, tDynamic('common', 'speechErrors.unknown'));
}

/**
 * 한 번 말하면 끝나는 받아쓰기. 인식기 이벤트는 앱 전체에 하나라 이 훅이 시작한 세션의 이벤트만 받는다.
 * 화면이 내려가면 결과를 받을 곳이 없으므로 듣던 세션을 끊는다.
 */
export function useDictation({ onResult, onEnd }: UseDictationOptions) {
  const speechRecognizer = useSpeechRecognizer();
  const ensureMicrophonePermission = useMicrophonePermission();
  const toast = useAppToast();
  const { resolvedLanguage } = useLanguage();
  const [isListening, setIsListening] = useState(false);
  const isMountedRef = useRef(false);
  const isSessionOwnerRef = useRef(false);
  const hasFailedRef = useRef(false);
  const isStopRequestedRef = useRef(false);

  const handleEvent = useEffectEvent((event: SpeechEvent) => {
    if (!isSessionOwnerRef.current) {
      return;
    }
    match(event)
      .with({ type: 'start' }, () => setIsListening(true))
      .with({ type: 'result' }, ({ transcript }) => {
        if (transcript.length > 0) {
          onResult(transcript);
        }
      })
      .with({ type: 'error' }, ({ code }) => {
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
        isSessionOwnerRef.current = false;
        setIsListening(false);
        if (!hasFailedRef.current) {
          onEnd?.();
        }
      })
      .with({ type: 'volume' }, { type: 'recording-started' }, { type: 'recording-saved' }, noop)
      .exhaustive();
  });

  useEffect(() => {
    isMountedRef.current = true;
    const unsubscribe = speechRecognizer.subscribe(handleEvent);

    return () => {
      isMountedRef.current = false;
      unsubscribe();
      if (isSessionOwnerRef.current) {
        isSessionOwnerRef.current = false;
        speechRecognizer.abort();
      }
    };
  }, [speechRecognizer]);

  /** 실패는 안에서 토스트로 알리므로 기다리지 않고 불러도 된다 */
  const start = async () => {
    hasFailedRef.current = false;
    isStopRequestedRef.current = false;
    try {
      const locale = APP_LANGUAGE_SPEECH_LOCALE[resolvedLanguage];
      const isGranted = await ensureMicrophonePermission('dictation', locale);
      // 권한을 묻는 사이 화면이 내려갔으면 시작하지 않는다
      if (!isGranted || !isMountedRef.current) {
        return;
      }
      isSessionOwnerRef.current = true;
      speechRecognizer.start({
        locale,
        mode: 'dictation',
        contextualStrings: [],
        isOnDevice: false,
        recordingDirectory: null,
      });
    } catch {
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
