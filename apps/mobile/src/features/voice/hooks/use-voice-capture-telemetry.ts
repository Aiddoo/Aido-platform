import { useErrorReporter, useLogger } from '@src/bootstrap/providers/di-context';
import type { SpeechErrorCode, SpeechLocale, SpeechMode } from '@src/core/ports/speech-recognizer';
import type {
  VoiceCaptureEntry,
  VoiceCaptureOutcome,
} from '@src/features/voice/constants/voice.events';
import { useTrack } from '@src/shared/analytics';
import { getErrorMessage } from '@src/shared/errors';

import { VOICE_LOG_EVENT } from '../constants/voice-log-events';
import {
  type VoiceCaptureFailureReason,
  VoiceCapturePolicy,
  type VoiceCaptureState,
  type VoicePauseCause,
} from '../domains/voice-capture.model';
import { getDurationBucket } from '../utils/voice-analytics';

const PAUSE_CAUSE_PARAMS = {
  'app-background': 'app_background',
  interrupted: 'interrupted',
  user: 'user',
  limit: 'limit',
} as const satisfies Record<VoicePauseCause, string>;

interface UseVoiceCaptureTelemetryOptions {
  entry: VoiceCaptureEntry;
  mode: Extract<SpeechMode, 'quick' | 'note'>;
}

/** 말하기 세션의 분석 이벤트, breadcrumb, 로그. 이름과 값은 대시보드가 읽는 계약이라 바꾸지 않는다 */
export function useVoiceCaptureTelemetry({ entry, mode }: UseVoiceCaptureTelemetryOptions) {
  const logger = useLogger();
  const errorReporter = useErrorReporter();
  const { trackEvent } = useTrack();

  const addBreadcrumb = (message: string, data?: Record<string, unknown>) => {
    errorReporter.addBreadcrumb({ category: 'voice', message, data });
  };

  return {
    started: (locale: SpeechLocale, isOnDevice: boolean) => {
      trackEvent('voice_capture_started', { mode, entry, locale, on_device: isOnDevice });
      addBreadcrumb('capture.started', { mode, locale, on_device: isOnDevice });
    },
    finished: (outcome: VoiceCaptureOutcome, at: VoiceCaptureState) => {
      const durationBucket = getDurationBucket(VoiceCapturePolicy.getElapsedMs(at, Date.now()));
      trackEvent('voice_capture_finished', {
        mode,
        outcome,
        duration_bucket: durationBucket,
        pause_count: at.pauseCount,
      });
      addBreadcrumb('capture.finished', { mode, duration_bucket: durationBucket });
    },
    failed: (reason: VoiceCaptureFailureReason) => {
      trackEvent('voice_capture_failed', { mode, reason });
    },
    paused: (cause: VoicePauseCause) => {
      addBreadcrumb('capture.paused', { mode, cause });
    },
    resumed: (cause: VoicePauseCause) => {
      trackEvent('voice_capture_resumed', { mode, cause: PAUSE_CAUSE_PARAMS[cause] });
      addBreadcrumb('capture.resumed', { mode });
    },
    stalled: (isOnDevice: boolean) => {
      trackEvent('voice_recognizer_stalled', { mode, on_device: isOnDevice });
      addBreadcrumb('capture.recognizer-stalled', { mode, on_device: isOnDevice });
    },
    localeChanged: (locale: SpeechLocale, isOnDevice: boolean) => {
      trackEvent('voice_capture_locale_changed', { mode, locale, on_device: isOnDevice });
    },
    planRequested: () => {
      addBreadcrumb('plan.requested', { mode });
    },
    recognizerFailed: (code: SpeechErrorCode, isOnDevice: boolean | undefined) => {
      logger.error(VOICE_LOG_EVENT.RECOGNIZER_FAILED, new Error(code), {
        speech_error: code,
        on_device: isOnDevice,
      });
    },
    recognizerStopped: (code: SpeechErrorCode, isOnDevice: boolean | undefined) => {
      logger.info(VOICE_LOG_EVENT.RECOGNIZER_EXPECTED_STOP, {
        speech_error: code,
        on_device: isOnDevice,
      });
    },
    capabilityCheckFailed: (error: unknown) => {
      logger.error(VOICE_LOG_EVENT.RECOGNIZER_FAILED, new Error(getErrorMessage(error)), {
        speech_error: 'unknown',
      });
    },
  };
}
