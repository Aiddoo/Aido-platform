import type { SpeechLocale } from '@src/core/ports/speech-recognizer';

import type { VoiceCaptureFailureReason } from '../domains/voice-capture.model';
import type { VoicePlanFailureCause } from '../domains/voice.error';

export type VoiceCaptureMode = 'quick' | 'note';
export type VoiceCaptureEntry = 'add_todo_sheet' | 'memo_tab' | 'quick_voice_upgrade';
export type VoiceCaptureOutcome = 'completed' | 'cancelled' | 'empty' | 'upgraded';
export type VoiceDurationBucket = 'lt_30s' | '30s_3m' | '3m_10m' | '10m_30m';

/** 계획을 만든 흐름. 제목·내용은 이벤트에 싣지 않는다 */
export type VoicePlanAnalyticsSource = 'quick_voice' | 'quick_text' | 'voice_note' | 'memo';

/** 말한 내용·전사 글자는 어떤 이벤트에도 싣지 않는다. 길이는 구간으로만 남긴다 */
declare module '@src/shared/analytics/event-map' {
  interface AppEventMap {
    /** 듣기를 시작하려고 눌렀다. 한도·동의·마이크 권한을 묻기 전이라 막혀도 보낸다 */
    voice_capture_start_tapped: { mode: VoiceCaptureMode; entry: VoiceCaptureEntry };
    /** 시스템 마이크·음성 인식 권한 창을 띄웠다. `status`는 창을 닫은 뒤 상태다 */
    voice_permission_requested: { mode: VoiceCaptureMode; status: 'granted' | 'denied' };
    voice_capture_started: {
      mode: VoiceCaptureMode;
      entry: VoiceCaptureEntry;
      locale: SpeechLocale;
      on_device: boolean;
    };
    voice_capture_finished: {
      mode: VoiceCaptureMode;
      outcome: VoiceCaptureOutcome;
      duration_bucket: VoiceDurationBucket;
      pause_count: number;
    };
    voice_capture_failed: { mode: VoiceCaptureMode; reason: VoiceCaptureFailureReason };
    voice_capture_resumed: {
      mode: VoiceCaptureMode;
      cause: 'app_background' | 'interrupted' | 'user' | 'limit';
    };
    /** 듣는 중에 인식 언어를 바꿨다. `voice_capture_started`의 `locale`은 시작할 때 값 그대로다 */
    voice_capture_locale_changed: {
      mode: VoiceCaptureMode;
      locale: SpeechLocale;
      on_device: boolean;
    };
    /** 말소리는 들리는데 글자 없는 구간만 이어져 인식기를 다시 열었다 */
    voice_recognizer_stalled: { mode: VoiceCaptureMode; on_device: boolean };
    /** Android 기기 인식 언어 모델 받기를 물었다. 거절이면 declined다 */
    voice_offline_model_requested: {
      locale: SpeechLocale;
      result: 'downloaded' | 'scheduled' | 'dialog-opened' | 'unavailable' | 'declined';
    };
    /** 말로 메모를 지웠다. 정리(요약)를 받은 뒤인지만 남긴다 */
    voice_note_deleted: { is_digested: boolean };
    /** 핵심 포인트를 눌러 그 지점부터 들었다. 위치는 구간으로만 남긴다 */
    voice_note_key_point_played: { position_bucket: VoiceDurationBucket };
    voice_plan_generated: {
      source: VoicePlanAnalyticsSource;
      todo_count: number;
      memo_count: number;
      duplicate_count: number;
      /** 서버가 알려 준 차감 여부. 성공해도 false일 수 있고, 메모 나누기 응답에는 없다 */
      charged?: boolean;
    };
    voice_plan_failed: { source: VoicePlanAnalyticsSource; cause: VoicePlanFailureCause };
    voice_plan_applied: {
      source: VoicePlanAnalyticsSource;
      todo_count: number;
      memo_count: number;
      skipped_count: number;
    };
  }
}
