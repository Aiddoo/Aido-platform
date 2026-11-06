import {
  useErrorReporter,
  useHaptics,
  useIdGenerator,
  useOfflineModelPromptRepository,
  useSpeechRecognizer,
  useVoiceNoteStorageService,
} from '@src/bootstrap/providers/di-context';
import type { SpeechEvent, SpeechLocale } from '@src/core/ports/speech-recognizer';
import { useTrack } from '@src/shared/analytics';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { t } from '@src/shared/i18n';
import type { VoiceCaptureEntry } from '@src/shared/observability/telemetry-keys';
import { useConfirmDialog } from '@src/shared/ui';
import { noop, sortBy } from 'es-toolkit';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { match } from 'ts-pattern';

import {
  VOICE_RECORDING_LATE_WAIT_MS,
  VOICE_RECORDING_SAVE_WAIT_MS,
} from '../constants/voice-note.constants';
import {
  type VoiceNoteCaptions,
  VoiceNoteCaptionPolicy,
} from '../domains/voice-note-caption.model';
import {
  type VoiceNote,
  VoiceNotePolicy,
  type VoiceNoteRecording,
} from '../domains/voice-note.model';
import { VoiceTranscriptPolicy } from '../domains/voice-transcript.model';
import { useVoiceCaptureSession } from './use-voice-capture-session';

interface UseVoiceNoteRecordingOptions {
  accountId: string;
  locale: SpeechLocale;
  seedDraftId?: string;
  entry?: Extract<VoiceCaptureEntry, 'memo_tab' | 'quick_voice_upgrade'>;
  /** 서버 한도의 한 번 최대 길이(초). null이면 끝이 없다 */
  maxSeconds: number | null;
  onLimitReached: () => void;
  onFinished: (draftId: string) => void;
  onEmpty: () => void;
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
  const speechRecognizer = useSpeechRecognizer();
  const storage = useVoiceNoteStorageService();
  const offlineModelPrompt = useOfflineModelPromptRepository();
  const toast = useAppToast();
  const confirmDialog = useConfirmDialog();
  const errorReporter = useErrorReporter();
  const haptics = useHaptics();
  const idGenerator = useIdGenerator();
  const { trackEvent } = useTrack();

  const [seedNote] = useState(() =>
    seedDraftId == null ? undefined : storage.drafts.find(accountId, seedDraftId),
  );
  const [baseNote] = useState<VoiceNote>(
    () =>
      seedNote ??
      VoiceNotePolicy.createVoiceNote({
        draftId: idGenerator.create(),
        locale,
        createdAt: new Date(),
      }),
  );
  const [captions, setCaptions] = useState<VoiceNoteCaptions>(() =>
    seedNote == null
      ? VoiceNoteCaptionPolicy.createVoiceNoteCaptions()
      : VoiceNoteCaptionPolicy.createCaptionsFromNote(seedNote),
  );
  const captionsRef = useRef(captions);
  const recordingsRef = useRef<VoiceNoteRecording[]>([]);
  const pendingSavesRef = useRef<Promise<void>[]>([]);
  const segmentStartsRef = useRef(new Map<string, number>());
  const currentSegmentStartRef = useRef(0);
  const partCountRef = useRef(0);
  const hasBegunRef = useRef(false);
  const notifyRecordingsArrivedRef = useRef<(() => void) | null>(null);
  /** 정리 화면으로 넘겼다. 이제 초안의 주인은 그 화면이라 녹음 조각만 더한다 */
  const hasHandedOffRef = useRef(false);
  /** 사용자가 초안을 지웠다. 뒤늦은 글자·파일이 초안을 되살리지 않게 막는다 */
  const hasDiscardedRef = useRef(false);

  /** 일시정지·한도 직후에 끝내면 파일이 아직 안 왔을 수 있어 잠깐 기다린다 */
  const waitForRecordings = () =>
    new Promise<void>((resolve) => {
      if (segmentStartsRef.current.size === 0) {
        resolve();
        return;
      }
      const timer = setTimeout(resolve, VOICE_RECORDING_SAVE_WAIT_MS);
      notifyRecordingsArrivedRef.current = () => {
        clearTimeout(timer);
        resolve();
      };
    });

  const onCaptured = async () => {
    await waitForRecordings();
    notifyRecordingsArrivedRef.current = null;
    await Promise.allSettled(pendingSavesRef.current);
    persist('now');
    hasHandedOffRef.current = true;
    hasBegunRef.current = false;
    onFinished(baseNote.draftId);
    return null;
  };

  const session = useVoiceCaptureSession({
    entry,
    mode: 'note',
    maxSeconds,
    onLimitReached,
    onCaptured,
  });

  const toNote = (): VoiceNote => {
    const nowMs = session.getElapsedMs();
    return VoiceNotePolicy.withRecordings(
      VoiceNotePolicy.withSentences(
        baseNote,
        VoiceNoteCaptionPolicy.getCaptionSentences(captionsRef.current, nowMs),
        nowMs,
      ),
      recordingsRef.current,
    );
  };

  function persist(timing: 'later' | 'now') {
    if (hasHandedOffRef.current || hasDiscardedRef.current) {
      return;
    }
    const note = toNote();
    if (note.sentences.length === 0) {
      return;
    }
    if (timing === 'now') {
      storage.drafts.save(accountId, note);
    } else {
      storage.drafts.scheduleSave(accountId, note);
    }
  }

  const updateCaptions = (next: VoiceNoteCaptions) => {
    if (next === captionsRef.current) {
      return;
    }
    captionsRef.current = next;
    setCaptions(next);
    persist('later');
  };

  const saveRecording = async (sourceUri: string, startMs: number) => {
    const partIndex = partCountRef.current;
    partCountRef.current += 1;
    const fileName = await storage.recordings.save({
      accountId,
      draftId: baseNote.draftId,
      partIndex,
      sourceUri,
    });
    if (fileName == null) {
      return;
    }
    if (hasDiscardedRef.current) {
      storage.recordings.remove(accountId, fileName);
      return;
    }
    recordingsRef.current = sortBy(
      [...recordingsRef.current, { fileName, startMs }],
      [({ startMs: partStartMs }) => partStartMs],
    );
    persist('later');
    const handedOff = hasHandedOffRef.current
      ? storage.drafts.find(accountId, baseNote.draftId)
      : undefined;
    if (handedOff != null) {
      storage.drafts.save(
        accountId,
        VoiceNotePolicy.withRecordings(handedOff, recordingsRef.current),
      );
    }
  };

  const receiveRecording = (uri: string) => {
    const startMs = segmentStartsRef.current.get(uri) ?? currentSegmentStartRef.current;
    segmentStartsRef.current.delete(uri);
    if (!hasDiscardedRef.current) {
      pendingSavesRef.current = [...pendingSavesRef.current, saveRecording(uri, startMs)];
    }
    if (segmentStartsRef.current.size === 0) {
      notifyRecordingsArrivedRef.current?.();
    }
  };

  /** 기다리는 시간을 넘겨 화면이 내려간 뒤에 온 파일도 초안에 더한다. 받으면 끝내고, 오지 않아도 잠시 뒤 끝낸다 */
  const keepListeningForLateRecordings = () => {
    if (!hasHandedOffRef.current || segmentStartsRef.current.size === 0) {
      return;
    }
    const stop = () => {
      clearTimeout(timer);
      unsubscribe();
    };
    const unsubscribe = speechRecognizer.subscribe((event) => {
      if (event.type !== 'recording-saved') {
        return;
      }
      receiveRecording(event.uri);
      if (segmentStartsRef.current.size === 0) {
        stop();
      }
    });
    const timer = setTimeout(stop, VOICE_RECORDING_LATE_WAIT_MS);
  };

  const handleSpeechEvent = useEffectEvent((event: SpeechEvent) => {
    match(event)
      .with({ type: 'start' }, () => {
        currentSegmentStartRef.current = session.getElapsedMs();
      })
      .with({ type: 'recording-started' }, ({ uri }) => {
        segmentStartsRef.current.set(uri, session.getElapsedMs());
      })
      .with({ type: 'result' }, (result) => {
        updateCaptions(
          VoiceNoteCaptionPolicy.applyCaptionResult(captionsRef.current, result, {
            nowMs: session.getElapsedMs(),
            segmentStartMs: currentSegmentStartRef.current,
          }),
        );
      })
      .with({ type: 'end' }, () => {
        updateCaptions(
          VoiceNoteCaptionPolicy.commitProvisional(captionsRef.current, session.getElapsedMs()),
        );
      })
      .with({ type: 'recording-saved' }, ({ uri }) => receiveRecording(uri))
      .with({ type: 'volume' }, { type: 'error' }, { type: 'no-match' }, noop)
      .exhaustive();
  });

  useEffect(() => {
    const unsubscribe = speechRecognizer.subscribe(handleSpeechEvent);

    return () => {
      unsubscribe();
      keepListeningForLateRecordings();
    };
    // 파일 받기는 ref만 읽어 화면이 내려간 뒤에도 그대로 동작한다
  }, [speechRecognizer]);

  function removeLocalNote() {
    hasDiscardedRef.current = true;
    recordingsRef.current.forEach(({ fileName }) => storage.recordings.remove(accountId, fileName));
    storage.discard(accountId, baseNote.draftId);
  }

  const { status } = session.state;
  const flushDraft = useEffectEvent(() => {
    persist('now');
  });
  const notifyEmpty = useEffectEvent(() => {
    if (hasBegunRef.current) {
      hasBegunRef.current = false;
      removeLocalNote();
      onEmpty();
    }
  });
  useEffect(() => {
    if (status === 'paused' || status === 'failed') {
      flushDraft();
    }
    // 듣기를 시작한 뒤 처음으로 돌아왔다면 들은 글자 없이 끝난 것이다
    if (status === 'idle') {
      notifyEmpty();
    }
  }, [status]);

  /**
   * Android에 이 언어 모델이 없으면 받을지 한 번만 묻는다. 거절하거나 시스템 창에서 취소했거나(결과를 알려주지 않는다)
   * 받을 수 없으면 그 언어는 다시 묻지 않고 네트워크 인식으로 이어 간다.
   */
  const offerOnDeviceModel = async (startLocale: SpeechLocale) => {
    const { canDownloadOnDeviceModel } = await speechRecognizer.getCapabilities(
      startLocale,
      'note',
    );
    if (!canDownloadOnDeviceModel || offlineModelPrompt.hasDeclined(accountId, startLocale)) {
      return;
    }
    const shouldDownload = await confirmDialog.open({
      title: t('voiceNote:offlineModel.title'),
      description: t('voiceNote:offlineModel.description'),
      confirmLabel: t('voiceNote:offlineModel.confirm'),
      cancelLabel: t('voiceNote:offlineModel.cancel'),
    });
    if (!shouldDownload) {
      offlineModelPrompt.saveDeclined(accountId, startLocale);
      trackEvent('voice_offline_model_requested', { locale: startLocale, result: 'declined' });
      return;
    }
    const result = await speechRecognizer.requestOfflineModel(startLocale);
    if (result !== 'downloaded') {
      offlineModelPrompt.saveDeclined(accountId, startLocale);
    }
    trackEvent('voice_offline_model_requested', { locale: startLocale, result });
    errorReporter.addBreadcrumb({
      category: 'voice',
      message: 'offline-model.requested',
      data: { locale: startLocale, result },
    });
    if (result === 'scheduled') {
      toast.toast(t('voiceNote:offlineModel.scheduled'));
    }
  };

  const start = async ({
    startLocale,
    contextualStrings,
  }: {
    startLocale: SpeechLocale;
    contextualStrings: readonly string[];
  }) => {
    await offerOnDeviceModel(startLocale);
    const hasBegun = await session.begin({
      locale: startLocale,
      contextualStrings,
      recordingDirectory: storage.recordings.prepareDirectory(accountId),
      seed:
        seedNote == null
          ? undefined
          : {
              transcript: VoiceTranscriptPolicy.createVoiceTranscript({
                sentences: seedNote.sentences.map(({ text }) => text),
              }),
              elapsedMs: seedNote.durationMs,
            },
    });
    hasBegunRef.current = hasBegun;
  };

  const mark = () => {
    haptics.selection();
    updateCaptions(
      VoiceNoteCaptionPolicy.withBookmark(captionsRef.current, session.getElapsedMs()),
    );
  };

  const discard = () => {
    hasBegunRef.current = false;
    session.cancel();
    removeLocalNote();
  };

  return {
    ...session,
    draftId: baseNote.draftId,
    /** 카드로 그릴 문장. 아직 바뀔 수 있는 마지막 문장은 `interimText`로 따로 그린다 */
    sentences: VoiceNoteCaptionPolicy.getCaptionSentences(
      { ...captions, provisional: captions.provisional.slice(0, -1) },
      0,
    ),
    interimText: VoiceNoteCaptionPolicy.getCaptionInterimText(captions),
    /** 이어 받은 글자까지 포함해 들은 글자가 있다. 있으면 묻지 않고 지우면 안 된다 */
    hasText: VoiceNoteCaptionPolicy.hasCaptionText(captions),
    bookmarksMs: captions.bookmarksMs,
    markCount: VoiceNoteCaptionPolicy.getMarkedSentenceCount(captions),
    start,
    mark,
    discard,
  };
}
