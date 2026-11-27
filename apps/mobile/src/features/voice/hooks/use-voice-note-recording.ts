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
import { useIsUnmountedRef } from '@src/shared/hooks/use-is-unmounted-ref';
import { t } from '@src/shared/i18n';
import { readStoredValue, writeStoredValue } from '@src/shared/storage/define-stored-value';
import { useStoredValueStorage } from '@src/shared/storage/use-stored-value';
import { useConfirmDialog } from '@src/shared/ui';
import { useAppToast } from '@src/shared/ui';
import { noop } from 'es-toolkit';
import {
  type RefObject,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import type { SharedValue } from 'react-native-reanimated';
import { match } from 'ts-pattern';

import type { VoiceCaptureEntry } from '../constants/voice.events';
import { VoiceCapturePolicy, type VoiceCaptureState } from '../domains/voice-capture.model';
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
import { type VoiceCaptureControls, useVoiceCaptureSession } from './use-voice-capture-session';
import { useVoiceCaptureTelemetry } from './use-voice-capture-telemetry';

type VoiceNoteEntry = Extract<VoiceCaptureEntry, 'memo_tab' | 'quick_voice_upgrade'>;

/** 초안을 바로 쓸지(`now`), 잦은 변화를 모아 쓸지(`later`) */
type PersistTiming = 'later' | 'now';
type PersistDraft = (timing: PersistTiming) => void;

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
  discard: () => void;
}

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
  const [seedNote, baseNote] = useVoiceNoteBase({ accountId, locale, seedDraftId });
  // 저장은 아래의 세션·자막을 읽고, 세션·자막은 바뀔 때 저장을 부른다. 서로 물려 가장 최근 저장을 ref로 잇는다
  const persistRef = useRef<PersistDraft>(noop);
  const intake = useRecordingIntake({
    accountId,
    draftId: baseNote.draftId,
    onRecordingSaved: () => persistRef.current('later'),
  });
  const isUnmountedRef = useIsUnmountedRef();
  const [capture, session] = useVoiceCaptureSession({
    entry,
    mode: 'note',
    maxSeconds,
    onLimitReached,
    onCaptured: () =>
      handOffFinishedNote({
        intake,
        persistRef,
        isUnmountedRef,
        onHandedOff: () => onFinished(baseNote.draftId),
      }),
  });
  const captions = useVoiceNoteCaptions({
    seedNote,
    getElapsedMs: session.getElapsedMs,
    onChange: () => persistRef.current('later'),
  });
  const persist = usePersistDraft({
    accountId,
    baseNote,
    intake,
    captions,
    getElapsedMs: session.getElapsedMs,
  });
  useLayoutEffect(() => {
    persistRef.current = persist;
  });
  useNoteSpeechEvents({ getElapsedMs: session.getElapsedMs, captions, intake });
  useFlushDraftWhenStopped({ status: capture.state.status, onStopped: () => persist('now') });
  useEmptyRecordingNotice({ state: capture.state, intake, onEmpty });
  const start = useStartRecording({
    accountId,
    entry,
    seedNote,
    begin: session.begin,
    isAbandoned: () => isUnmountedRef.current || intake.isDiscarded(),
  });

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
    discard: () => {
      session.cancel();
      intake.discard();
    },
  };

  return [recording, controls] as const;
}

interface UseVoiceNoteBaseOptions {
  accountId: string;
  locale: SpeechLocale;
  seedDraftId?: string;
}

/** 이어 듣는 초안(새 녹음이면 null)과 이번 녹음이 쓰는 초안의 바탕. 화면에 들어온 순간의 값으로 고정해 녹음 중에 저장된 초안으로 바뀌지 않는다 */
function useVoiceNoteBase({
  accountId,
  locale,
  seedDraftId,
}: UseVoiceNoteBaseOptions): [seedNote: VoiceNote | null, baseNote: VoiceNote] {
  const draftRepository = useVoiceNoteDraftRepository();
  const idGenerator = useIdGenerator();
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

  return [seedNote, baseNote];
}

interface HandOffFinishedNoteOptions {
  intake: VoiceRecordingIntakeSession;
  /** 파일을 기다린 뒤의 가장 최근 저장을 읽는다 */
  persistRef: RefObject<PersistDraft>;
  isUnmountedRef: RefObject<boolean>;
  onHandedOff: () => void;
}

/** 말로 메모하기는 고르는 단계가 없다. 녹음 파일까지 받아 초안을 저장하고 넘긴 뒤 계획 없이(null) 처음으로 돌아간다 */
async function handOffFinishedNote({
  intake,
  persistRef,
  isUnmountedRef,
  onHandedOff,
}: HandOffFinishedNoteOptions): Promise<null> {
  await intake.waitUntilSettled();
  persistRef.current('now');
  intake.handOff();
  // 끝내는 동안 사용자가 이미 떠났다. 글자는 저장했고 다른 화면에서 끌어오지 않는다
  if (!isUnmountedRef.current) {
    onHandedOff();
  }
  return null;
}

interface UseRecordingIntakeOptions {
  accountId: string;
  draftId: string;
  /** 조각 하나를 초안 이름으로 옮겼다. 화면이 내려간 뒤에도 불린다 */
  onRecordingSaved: () => void;
}

/** 놓을 때 아직 오지 않은 파일이 있으면 세션이 스스로 듣다가(최대 30초) 끝낸다 */
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
    // StrictMode·Fast Refresh로 effect가 다시 돌면 남은 늦은 파일 듣기를 거둬 같은 파일을 두 번 받아 옮기지 않는다
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

type CaptionResult = Parameters<typeof VoiceNoteCaptionsPolicy.applyCaptionResult>[1];

interface VoiceNoteCaptionsView {
  sentences: readonly VoiceNoteSentence[];
  interimText: string;
  hasText: boolean;
  bookmarksMs: readonly number[];
  markCount: number;
  mark: () => void;
  applyResult: (result: CaptionResult, segmentStartMs: number) => void;
  commitProvisional: () => void;
  getSentencesAt: (nowMs: number) => VoiceNoteSentence[];
}

function useVoiceNoteCaptions({
  seedNote,
  getElapsedMs,
  onChange,
}: UseVoiceNoteCaptionsOptions): VoiceNoteCaptionsView {
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
    applyResult: (result, segmentStartMs) => {
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
    getSentencesAt: (nowMs) =>
      VoiceNoteCaptionsPolicy.getCaptionSentences(captionsRef.current, nowMs),
  };
}

interface UsePersistDraftOptions {
  accountId: string;
  baseNote: VoiceNote;
  intake: VoiceRecordingIntakeSession;
  captions: VoiceNoteCaptionsView;
  getElapsedMs: () => number;
}

function usePersistDraft({
  accountId,
  baseNote,
  intake,
  captions,
  getElapsedMs,
}: UsePersistDraftOptions): PersistDraft {
  const draftRepository = useVoiceNoteDraftRepository();

  const toNote = (): VoiceNote => {
    const nowMs = getElapsedMs();
    return VoiceNotePolicy.withRecordings(
      VoiceNotePolicy.withSentences(baseNote, captions.getSentencesAt(nowMs), nowMs),
      intake.getRecordings(),
    );
  };

  return (timing) => {
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
}

interface UseNoteSpeechEventsOptions {
  getElapsedMs: () => number;
  captions: VoiceNoteCaptionsView;
  intake: VoiceRecordingIntakeSession;
}

function useNoteSpeechEvents({ getElapsedMs, captions, intake }: UseNoteSpeechEventsOptions) {
  const currentSegmentStartRef = useRef(0);

  useSpeechEvent((event) => {
    match(event)
      .with({ type: 'start' }, () => {
        currentSegmentStartRef.current = getElapsedMs();
      })
      .with({ type: 'recording-started' }, ({ uri }) => {
        intake.segmentStarted(uri, getElapsedMs());
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
}

interface UseFlushDraftWhenStoppedOptions {
  status: VoiceCaptureState['status'];
  onStopped: () => void;
}

/** 멈추거나 실패하면 모아 쓰던 초안을 바로 쓴다. 그대로 앱이 꺼져도 듣던 글자가 남는다 */
function useFlushDraftWhenStopped({ status, onStopped }: UseFlushDraftWhenStoppedOptions) {
  const flushDraft = useEffectEvent(onStopped);

  useEffect(() => {
    if (status === 'paused' || status === 'failed') {
      flushDraft();
    }
  }, [status]);
}

interface UseEmptyRecordingNoticeOptions {
  state: VoiceCaptureState;
  intake: VoiceRecordingIntakeSession;
  onEmpty: () => void;
}

/** 열린 녹음이 들은 글자 없이 끝나면 초안을 지우고 알린다. 닫으며 지운 초안은 알리지 않는다 */
function useEmptyRecordingNotice({ state, intake, onEmpty }: UseEmptyRecordingNoticeOptions) {
  const previousStateRef = useRef(state);

  // 시작이 성공했는지가 아니라 상태가 열렸다 빈 채로 돌아온 것을 본다. 기능 확인이 실패한 뒤 이어 듣기로 연 녹음도 같은 길로 알린다
  const notifyIfEndedEmpty = useEffectEvent(() => {
    const previous = previousStateRef.current;
    previousStateRef.current = state;
    if (VoiceCapturePolicy.hasEndedEmpty(state, previous) && !intake.isDiscarded()) {
      intake.discard();
      onEmpty();
    }
  });

  useEffect(() => {
    notifyIfEndedEmpty();
  }, [state.status]);
}

interface UseStartRecordingOptions {
  accountId: string;
  entry: VoiceNoteEntry;
  /** 이어 듣는 초안이 있으면 그 글자와 시간 뒤로 듣는다 */
  seedNote: VoiceNote | null;
  begin: VoiceCaptureControls['begin'];
  /** 확인을 기다리는 사이 화면이 내려갔거나 초안을 지웠다. 묻지도 듣지도 않는다 */
  isAbandoned: () => boolean;
}

function useStartRecording({
  accountId,
  entry,
  seedNote,
  begin,
  isAbandoned,
}: UseStartRecordingOptions): VoiceNoteRecordingControls['start'] {
  const recordingRepository = useVoiceRecordingRepository();
  const offerOnDeviceModel = useOfferOnDeviceModel({ accountId, entry });

  return async ({ startLocale, hintWords }) => {
    await offerOnDeviceModel(startLocale, { isAbandoned });
    if (isAbandoned()) {
      return;
    }
    await begin({
      locale: startLocale,
      hintWords,
      recordingDirectory: recordingRepository.prepareDirectory(accountId),
      seed: seedNote == null ? undefined : VoiceNotePolicy.toCaptureSeed(seedNote),
    });
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
    // 시스템 창을 기다리는 사이 녹음을 그만뒀으면 다른 화면 위로 안내를 띄우지 않는다. 고른 결과는 위에서 남겼다
    if (result === 'scheduled' && !isAbandoned()) {
      toast.toast(t('voiceNote:offlineModel.scheduled'));
    }
  };
}
