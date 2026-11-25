import {
  useHaptics,
  useIdGenerator,
  useSignOutEpoch,
  useSpeechRecognizer,
  useVoiceNoteDraftRepository,
  useVoiceNoteStorageService,
  useVoiceRecordingRepository,
} from '@src/bootstrap/providers/di-context';
import type { SpeechLocale } from '@src/core/ports/speech-recognizer';
import { getNowInstant } from '@src/shared/date/clock';
import { t } from '@src/shared/i18n';
import { readStoredValue, writeStoredValue } from '@src/shared/storage/define-stored-value';
import { useStoredValueStorage } from '@src/shared/storage/use-stored-value';
import { useConfirmDialog } from '@src/shared/ui';
import { useAppToast } from '@src/shared/ui';
import { noop } from 'es-toolkit';
import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from 'react';
import type { SharedValue } from 'react-native-reanimated';
import { match } from 'ts-pattern';

import type { VoiceCaptureEntry } from '../constants/voice.events';
import type { VoiceCaptureState } from '../domains/voice-capture.model';
import {
  VoiceNoteCaptionsPolicy,
  type VoiceNoteCaptions,
  createVoiceNoteCaptions,
} from '../domains/voice-note-captions.model';
import {
  VoiceNotePolicy,
  type VoiceNote,
  type VoiceNoteSentence,
  createVoiceNote,
} from '../domains/voice-note.model';
import { offlineModelDeclinedStoredValue } from '../schemas/offline-model-declined-storage.schema';
import { VoiceRecordingIntakeSession } from '../services/voice-recording-intake.session';
import { useSpeechEvent } from './use-speech-event';
import { useVoiceCaptureSession } from './use-voice-capture-session';
import { useVoiceCaptureTelemetry } from './use-voice-capture-telemetry';

type VoiceNoteEntry = Extract<VoiceCaptureEntry, 'memo_tab' | 'quick_voice_upgrade'>;

/** 초안을 바로 쓸지(`now`), 잦은 변화를 모아 쓸지(`later`) */
type PersistTiming = 'later' | 'now';

interface UseVoiceNoteRecordingOptions {
  accountId: string;
  locale: SpeechLocale;
  seedDraftId?: string;
  entry?: VoiceNoteEntry;
  /** 서버 한도의 한 번 최대 길이(초). null이면 끝이 없다 */
  maxSeconds: number | null;
  onLimitReached: () => void;
  onFinished: (draftId: string) => void;
  onEmpty: () => void;
}

/** 녹음 화면이 그리는 값. 글자가 올 때마다 바뀐다 */
interface VoiceNoteRecordingView {
  state: VoiceCaptureState;
  /** 파형이 UI 스레드에서 읽는 음량 */
  level: SharedValue<number>;
  draftId: string;
  /** 카드로 그릴 문장. 아직 바뀔 수 있는 마지막 문장은 `interimText`로 따로 그린다 */
  sentences: readonly VoiceNoteSentence[];
  interimText: string;
  /** 이어 받은 글자까지 포함해 들은 글자가 있다. 있으면 묻지 않고 지우면 안 된다 */
  hasText: boolean;
  bookmarksMs: readonly number[];
  markCount: number;
}

interface VoiceNoteRecordingControls {
  start: (options: { startLocale: SpeechLocale; hintWords: readonly string[] }) => Promise<void>;
  finish: () => void;
  pause: () => void;
  /** 다른 화면이 올라와 듣기를 멈춘다 */
  interrupt: () => void;
  resume: () => void;
  changeLocale: (locale: SpeechLocale) => Promise<void>;
  mark: () => void;
  /** 듣기를 그만두고 초안과 녹음을 지운다 */
  discard: () => void;
}

/** 말로 메모 녹음. 들은 문장과 녹음 조각을 기기 초안에 남기고, 끝내면 초안 id를 넘긴다 */
export function useVoiceNoteRecording({
  accountId,
  locale,
  seedDraftId,
  entry = 'memo_tab',
  maxSeconds,
  onLimitReached,
  onFinished,
  onEmpty,
}: UseVoiceNoteRecordingOptions) {
  const draftRepository = useVoiceNoteDraftRepository();
  const recordingRepository = useVoiceRecordingRepository();
  const idGenerator = useIdGenerator();
  const offerOnDeviceModel = useOfferOnDeviceModel({ accountId, entry });

  const [seedNote] = useState(() =>
    seedDraftId == null ? null : draftRepository.find(accountId, seedDraftId),
  );
  const [baseNote] = useState<VoiceNote>(
    () =>
      seedNote ??
      createVoiceNote({
        draftId: idGenerator.create(),
        locale,
        createdAt: getNowInstant(),
      }),
  );
  // 저장은 아래의 세션·자막을 읽고, 세션·자막은 바뀔 때 저장을 부른다. 서로 물려 가장 최근 저장을 ref로 잇는다
  const persistRef = useRef<(timing: PersistTiming) => void>(noop);
  const intake = useRecordingIntake({
    accountId,
    draftId: baseNote.draftId,
    onRecordingSaved: () => persistRef.current('later'),
  });
  const currentSegmentStartRef = useRef(0);
  const hasBegunRef = useRef(false);
  const isUnmountedRef = useRef(false);

  /** 말로 메모하기는 고르는 단계가 없다. 녹음 파일까지 받아 초안을 저장하고 넘긴 뒤 계획 없이(null) 처음으로 돌아간다 */
  const saveFinishedNote = async () => {
    await intake.waitUntilSettled();
    persistRef.current('now');
    intake.handOff();
    // 끝내는 동안 사용자가 이미 떠났다. 글자는 저장했고 다른 화면에서 끌어오지 않는다
    if (!isUnmountedRef.current) {
      onFinished(baseNote.draftId);
    }
    return null;
  };

  const [capture, session] = useVoiceCaptureSession({
    entry,
    mode: 'note',
    maxSeconds,
    onLimitReached,
    onCaptured: saveFinishedNote,
  });

  const captions = useVoiceNoteCaptions({
    seedNote,
    getElapsedMs: session.getElapsedMs,
    onChange: () => persistRef.current('later'),
  });

  const toNote = (): VoiceNote => {
    const nowMs = session.getElapsedMs();
    return VoiceNotePolicy.withRecordings(
      VoiceNotePolicy.withSentences(baseNote, captions.getSentencesAt(nowMs), nowMs),
      intake.getRecordings(),
    );
  };

  const persist = (timing: PersistTiming) => {
    if (!intake.canWriteDraft()) {
      return;
    }
    const note = toNote();
    if (note.sentences.length === 0) {
      return;
    }
    if (timing === 'now') {
      draftRepository.save(accountId, note);
    } else {
      draftRepository.scheduleSave(accountId, note);
    }
  };
  useLayoutEffect(() => {
    persistRef.current = persist;
  });

  useSpeechEvent((event) => {
    match(event)
      .with({ type: 'start' }, () => {
        currentSegmentStartRef.current = session.getElapsedMs();
      })
      .with({ type: 'recording-started' }, ({ uri }) => {
        intake.segmentStarted(uri, session.getElapsedMs());
      })
      .with({ type: 'result' }, (result) => {
        captions.applyResult(result, currentSegmentStartRef.current);
      })
      .with({ type: 'end' }, () => {
        captions.commitProvisional();
      })
      .with({ type: 'recording-saved' }, ({ uri }) => {
        intake.receive(uri, currentSegmentStartRef.current);
      })
      .with({ type: 'volume' }, { type: 'error' }, { type: 'no-match' }, noop)
      .exhaustive();
  });

  useEffect(() => {
    isUnmountedRef.current = false;

    return () => {
      isUnmountedRef.current = true;
    };
  }, []);

  const { status } = capture.state;
  const previousStatusRef = useRef(status);
  const flushDraft = useEffectEvent(() => {
    persist('now');
  });
  const notifyEmpty = useEffectEvent(() => {
    if (hasBegunRef.current) {
      hasBegunRef.current = false;
      intake.discard();
      onEmpty();
    }
  });
  useEffect(() => {
    const previousStatus = previousStatusRef.current;
    previousStatusRef.current = status;
    if (status === 'paused' || status === 'failed') {
      flushDraft();
    }
    // 듣기를 시작한 뒤 처음으로 돌아왔다면 들은 글자 없이 끝난 것이다. 저장하고 넘긴 끝내기는 planning을 거친다
    if (status === 'idle' && previousStatus !== 'planning') {
      notifyEmpty();
    }
  }, [status]);

  /** 확인을 기다리는 사이 화면이 내려갔거나 초안을 지웠다. 묻지도 듣지도 않는다 */
  const isStartAbandoned = () => isUnmountedRef.current || intake.isDiscarded();

  const start: VoiceNoteRecordingControls['start'] = async ({ startLocale, hintWords }) => {
    await offerOnDeviceModel(startLocale, { isAbandoned: isStartAbandoned });
    if (isStartAbandoned()) {
      return;
    }
    const hasBegun = await session.begin({
      locale: startLocale,
      hintWords,
      recordingDirectory: recordingRepository.prepareDirectory(accountId),
      seed: seedNote == null ? undefined : VoiceNotePolicy.toCaptureSeed(seedNote),
    });
    hasBegunRef.current = hasBegun;
  };

  const discard = () => {
    hasBegunRef.current = false;
    session.cancel();
    intake.discard();
  };

  const recording: VoiceNoteRecordingView = {
    state: capture.state,
    level: capture.level,
    draftId: baseNote.draftId,
    sentences: captions.sentences,
    interimText: captions.interimText,
    hasText: captions.hasText,
    bookmarksMs: captions.bookmarksMs,
    markCount: captions.markCount,
  };
  const controls: VoiceNoteRecordingControls = {
    start,
    finish: session.finish,
    pause: session.pause,
    interrupt: session.interrupt,
    resume: session.resume,
    changeLocale: session.changeLocale,
    mark: captions.mark,
    discard,
  };

  return [recording, controls] as const;
}

interface UseRecordingIntakeOptions {
  accountId: string;
  draftId: string;
  /** 조각 하나를 초안 이름으로 옮겼다. 화면이 내려간 뒤에도 불린다 */
  onRecordingSaved: () => void;
}

/**
 * 녹음 조각을 받는 세션의 수명. 이 훅이 만들고, 붙어 있는 동안은 화면의 인식기 구독이 파일을 넘긴다.
 * 놓을 때 아직 오지 않은 파일이 있으면 세션이 스스로 듣다가(최대 30초) 끝낸다
 */
function useRecordingIntake({ accountId, draftId, onRecordingSaved }: UseRecordingIntakeOptions) {
  const speechRecognizer = useSpeechRecognizer();
  const storage = useVoiceNoteStorageService();
  const draftRepository = useVoiceNoteDraftRepository();
  const recordingRepository = useVoiceRecordingRepository();
  const signOutEpoch = useSignOutEpoch();
  const [intake] = useState(
    () =>
      new VoiceRecordingIntakeSession({
        accountId,
        draftId,
        draftRepository,
        recordingRepository,
        discard: storage.discard,
        signOutEpoch,
        onRecordingSaved,
      }),
  );

  useEffect(() => {
    // StrictMode·Fast Refresh로 effect가 다시 돌면 앞 정리가 건 늦은 파일 듣기가 남아 있다. 같은 인식기를 화면이 다시
    // 들으므로 거둬, 같은 파일을 두 번 받아 옮기지 않는다
    intake.reclaim(speechRecognizer.subscribe);

    return () => intake.listenForLate(speechRecognizer.subscribe);
  }, [intake, speechRecognizer]);

  return intake;
}

interface UseVoiceNoteCaptionsOptions {
  /** 이어 듣는 초안. 없으면 빈 자막에서 시작한다 */
  seedNote: VoiceNote | null;
  getElapsedMs: () => number;
  /** 자막이 바뀌었다. 초안 저장은 부른 쪽이 맡는다 */
  onChange: () => void;
}

/** 녹음 화면에 그리는 자막과 중요 표시 */
function useVoiceNoteCaptions({ seedNote, getElapsedMs, onChange }: UseVoiceNoteCaptionsOptions) {
  const haptics = useHaptics();
  const [captions, setCaptions] = useState<VoiceNoteCaptions>(() =>
    seedNote == null ? createVoiceNoteCaptions() : createVoiceNoteCaptions(seedNote.sentences),
  );
  const captionsRef = useRef(captions);

  const update = (next: VoiceNoteCaptions) => {
    if (next === captionsRef.current) {
      return;
    }
    captionsRef.current = next;
    setCaptions(next);
    onChange();
  };

  return {
    sentences: VoiceNoteCaptionsPolicy.getSettledSentences(captions),
    interimText: VoiceNoteCaptionsPolicy.getCaptionInterimText(captions),
    hasText: VoiceNoteCaptionsPolicy.hasCaptionText(captions),
    bookmarksMs: captions.bookmarksMs,
    markCount: VoiceNoteCaptionsPolicy.getMarkedSentenceCount(captions),
    mark: () => {
      haptics.selection();
      update(VoiceNoteCaptionsPolicy.withBookmark(captionsRef.current, getElapsedMs()));
    },
    applyResult: (
      result: Parameters<typeof VoiceNoteCaptionsPolicy.applyCaptionResult>[1],
      segmentStartMs: number,
    ) => {
      update(
        VoiceNoteCaptionsPolicy.applyCaptionResult(captionsRef.current, result, {
          nowMs: getElapsedMs(),
          segmentStartMs,
        }),
      );
    },
    commitProvisional: () => {
      update(VoiceNoteCaptionsPolicy.commitProvisional(captionsRef.current, getElapsedMs()));
    },
    getSentencesAt: (nowMs: number) =>
      VoiceNoteCaptionsPolicy.getCaptionSentences(captionsRef.current, nowMs),
  };
}

interface UseOfferOnDeviceModelOptions {
  accountId: string;
  entry: VoiceNoteEntry;
}

interface OfferOnDeviceModelOptions {
  /** 확인을 기다리는 사이 녹음을 그만뒀다. 그 뒤로는 묻지도 받지도 않는다 */
  isAbandoned: () => boolean;
}

/** Android에 언어 모델이 없으면 한 번만 묻는다. 거절·시스템 창 취소·받을 수 없음이면 다시 묻지 않는다 */
function useOfferOnDeviceModel({ accountId, entry }: UseOfferOnDeviceModelOptions) {
  const speechRecognizer = useSpeechRecognizer();
  // 계정 범위 저장소라 로그아웃 때 지워지고, 읽지 못하면 한 번 더 묻는다
  const storage = useStoredValueStorage(offlineModelDeclinedStoredValue);
  const confirmDialog = useConfirmDialog();
  const toast = useAppToast();
  const telemetry = useVoiceCaptureTelemetry({ entry, mode: 'note' });

  return async (locale: SpeechLocale, { isAbandoned }: OfferOnDeviceModelOptions) => {
    const { canDownloadOnDeviceModel } = await speechRecognizer.getCapabilities('note', locale);
    if (isAbandoned()) {
      return;
    }
    const scope = { accountId, locale };
    if (
      !canDownloadOnDeviceModel ||
      readStoredValue(storage, offlineModelDeclinedStoredValue, scope) != null
    ) {
      return;
    }
    const shouldDownload = await confirmDialog.openAsync({
      title: t('voiceNote:offlineModel.title'),
      description: t('voiceNote:offlineModel.description'),
      confirmLabel: t('voiceNote:offlineModel.confirm'),
      cancelLabel: t('voiceNote:offlineModel.cancel'),
    });
    if (isAbandoned()) {
      return;
    }
    if (!shouldDownload) {
      writeStoredValue(storage, offlineModelDeclinedStoredValue, 'declined', scope);
      telemetry.offlineModelDeclined(locale);
      return;
    }
    const result = await speechRecognizer.requestOfflineModel(locale);
    if (result !== 'downloaded') {
      writeStoredValue(storage, offlineModelDeclinedStoredValue, 'declined', scope);
    }
    telemetry.offlineModelRequested(locale, result);
    if (result === 'scheduled') {
      toast.toast(t('voiceNote:offlineModel.scheduled'));
    }
  };
}
