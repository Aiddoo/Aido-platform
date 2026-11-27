import { useErrorReporter, useLogger } from '@src/bootstrap/providers/di-context';
import type { TelemetryData } from '@src/core/observability/telemetry-keys';
import type {
  OfflineModelResult,
  SpeechErrorCode,
  SpeechLocale,
  SpeechMode,
} from '@src/core/ports/speech-recognizer';
import { useTrack } from '@src/shared/analytics';
import { toError } from '@src/shared/errors';

import { VOICE_LOG_EVENT } from '../constants/voice-log-events';
import type { VoiceCaptureEntry, VoiceCaptureOutcome } from '../constants/voice.events';
import {
  type RecognizerUnresponsiveReason,
  VoiceCapturePolicy,
  type VoiceCaptureFailureReason,
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

export interface VoiceCaptureTelemetry {
  started: (locale: SpeechLocale, isOnDevice: boolean) => void;
  finished: (outcome: VoiceCaptureOutcome, state: VoiceCaptureState) => void;
  failed: (reason: VoiceCaptureFailureReason) => void;
  paused: (cause: VoicePauseCause) => void;
  resumed: (cause: VoicePauseCause) => void;
  stalled: (isOnDevice: boolean) => void;
  localeChanged: (locale: SpeechLocale, isOnDevice: boolean) => void;
  planRequested: () => void;
  recognizerFailed: (code: SpeechErrorCode, isOnDevice: boolean | undefined) => void;
  recognizerStopped: (code: SpeechErrorCode, isOnDevice: boolean | undefined) => void;
  recognizerUnresponsive: (
    reason: RecognizerUnresponsiveReason,
    isOnDevice: boolean | undefined,
  ) => void;
  offlineModelDeclined: (locale: SpeechLocale) => void;
  offlineModelRequested: (locale: SpeechLocale, result: OfflineModelResult) => void;
  capabilityCheckFailed: (error: unknown) => void;
}

/** 말하기 세션의 분석 이벤트, breadcrumb, 로그. 이름과 값은 대시보드가 읽는 계약이라 바꾸지 않는다 */
export function useVoiceCaptureTelemetry({
  entry,
  mode,
}: UseVoiceCaptureTelemetryOptions): VoiceCaptureTelemetry {
  const logger = useLogger();
  const errorReporter = useErrorReporter();
  const { trackEvent } = useTrack();

  const addBreadcrumb = (message: string, data?: TelemetryData) => {
    errorReporter.addBreadcrumb({ category: 'voice', message, data });
  };

  return {
    started: (locale, isOnDevice) => {
      trackEvent('voice_capture_started', { mode, entry, locale, on_device: isOnDevice });
      addBreadcrumb('capture.started', { mode, locale, on_device: isOnDevice });
    },
    finished: (outcome, state) => {
      const durationBucket = getDurationBucket(VoiceCapturePolicy.getElapsedMs(state, Date.now()));
      trackEvent('voice_capture_finished', {
        mode,
        outcome,
        duration_bucket: durationBucket,
        pause_count: state.pauseCount,
      });
      addBreadcrumb('capture.finished', { mode, duration_bucket: durationBucket });
    },
    failed: (reason) => {
      trackEvent('voice_capture_failed', { mode, reason });
    },
    paused: (cause) => {
      addBreadcrumb('capture.paused', { mode, cause });
    },
    resumed: (cause) => {
      trackEvent('voice_capture_resumed', { mode, cause: PAUSE_CAUSE_PARAMS[cause] });
      addBreadcrumb('capture.resumed', { mode });
    },
    stalled: (isOnDevice) => {
      trackEvent('voice_recognizer_stalled', { mode, on_device: isOnDevice });
      addBreadcrumb('capture.recognizer-stalled', { mode, on_device: isOnDevice });
    },
    localeChanged: (locale, isOnDevice) => {
      trackEvent('voice_capture_locale_changed', { mode, locale, on_device: isOnDevice });
    },
    planRequested: () => {
      addBreadcrumb('plan.requested', { mode });
    },
    recognizerFailed: (code, isOnDevice) => {
      logger.error(VOICE_LOG_EVENT.RECOGNIZER_FAILED, new Error(code), {
        speech_error: code,
        on_device: isOnDevice,
      });
    },
    recognizerStopped: (code, isOnDevice) => {
      logger.info(VOICE_LOG_EVENT.RECOGNIZER_EXPECTED_STOP, {
        speech_error: code,
        on_device: isOnDevice,
      });
    },
    recognizerUnresponsive: (reason, isOnDevice) => {
      logger.info(VOICE_LOG_EVENT.RECOGNIZER_UNRESPONSIVE, { reason, on_device: isOnDevice });
    },
    offlineModelDeclined: (locale) => {
      trackEvent('voice_offline_model_requested', { locale, result: 'declined' });
    },
    offlineModelRequested: (locale, result) => {
      trackEvent('voice_offline_model_requested', { locale, result });
      addBreadcrumb('offline-model.requested', { locale, result });
    },
    capabilityCheckFailed: (error) => {
      logger.error(VOICE_LOG_EVENT.RECOGNIZER_FAILED, toError(error), {
        speech_error: 'unknown',
      });
    },
  };
}
