import {
  useErrorReporter,
  useHaptics,
  useSpeechRecognizer,
  useVoiceNoteStorageService,
} from '@src/bootstrap/providers/di-context';
import type { SpeechEvent, SpeechLocale } from '@src/core/ports/speech-recognizer';
import { useTrack } from '@src/shared/analytics';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { t } from '@src/shared/i18n';
import { useConfirmDialog } from '@src/shared/ui';
import { noop } from 'es-toolkit';
import { randomUUID } from 'expo-crypto';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { match } from 'ts-pattern';

import { VOICE_RECORDING_SAVE_WAIT_MS } from '../constants/voice-note.constants';
import {
  applyCaptionResult,
  commitProvisional,
  createVoiceNoteCaptions,
  getCaptionInterimText,
  getCaptionSentences,
  type VoiceNoteCaptions,
  withBookmark,
} from '../domains/voice-note-caption.model';
import {
  createVoiceNote,
  type VoiceNote,
  type VoiceNoteRecording,
  withRecordings,
  withSentences,
} from '../domains/voice-note.model';
import { useVoiceCaptureSession } from './use-voice-capture-session';

interface UseVoiceNoteRecordingOptions {
  accountId: string;
  locale: SpeechLocale;
  /** 서버 한도의 한 번 최대 길이(초). null이면 끝이 없다 */
  maxSeconds: number | null;
  onLimitReached: () => void;
  /** 초안을 저장하고 정리 화면으로 넘어갈 때 */
  onFinished: (draftId: string) => void;
  /** 끝냈는데 들은 글자가 없을 때 */
  onEmpty: () => void;
}

/**
 * 녹음 화면의 세션. 인식은 `useVoiceCaptureSession`에 맡기고 여기서는 문장 시각·깃발·녹음 조각을 모아
 * 기기 초안에 이어서 저장한다. 앱이 꺼져도 마지막으로 저장한 글자는 메모 탭에 남는다.
 */
export function useVoiceNoteRecording({
  accountId,
  locale,
  maxSeconds,
  onLimitReached,
  onFinished,
  onEmpty,
}: UseVoiceNoteRecordingOptions) {
  const speechRecognizer = useSpeechRecognizer();
  const storage = useVoiceNoteStorageService();
  const toast = useAppToast();
  const confirmDialog = useConfirmDialog();
  const errorReporter = useErrorReporter();
  const haptics = useHaptics();
  const { trackEvent } = useTrack();

  const [baseNote] = useState<VoiceNote>(() =>
    createVoiceNote({ draftId: randomUUID(), locale, createdAt: new Date() }),
  );
  const [captions, setCaptions] = useState<VoiceNoteCaptions>(createVoiceNoteCaptions);
  const captionsRef = useRef(captions);
  const recordingsRef = useRef<VoiceNoteRecording[]>([]);
  const pendingSavesRef = useRef<Promise<void>[]>([]);
  /** 아직 파일을 받지 못한 인식 구간의 시작 시각. 파일은 구간 순서대로 온다 */
  const segmentStartsRef = useRef<number[]>([]);
  const currentSegmentStartRef = useRef(0);
  const partCountRef = useRef(0);
  const hasBegunRef = useRef(false);
  const savesRecordingRef = useRef(false);
  const notifyRecordingsArrivedRef = useRef<(() => void) | null>(null);
  /** 정리 화면으로 넘겼다. 이제 초안의 주인은 그 화면이라 녹음 조각만 더한다 */
  const hasHandedOffRef = useRef(false);

  /** 일시정지·한도 직후에 끝내면 파일이 아직 안 왔을 수 있다. 화면을 떠나면 파일 이벤트를 못 받아 잠깐 기다린다 */
  const waitForRecordings = () =>
    new Promise<void>((resolve) => {
      if (!savesRecordingRef.current || segmentStartsRef.current.length === 0) {
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
    onFinished(baseNote.draftId);
    return null;
  };

  const session = useVoiceCaptureSession({
    entry: 'memo_tab',
    mode: 'note',
    maxSeconds,
    onLimitReached,
    onCaptured,
  });

  const toNote = (): VoiceNote => {
    const nowMs = session.getElapsedMs();
    return withRecordings(
      withSentences(baseNote, getCaptionSentences(captionsRef.current, nowMs), nowMs),
      recordingsRef.current,
    );
  };

  function persist(timing: 'later' | 'now') {
    if (hasHandedOffRef.current) {
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
    const fileName = await storage.recordings.save({
      accountId,
      draftId: baseNote.draftId,
      partIndex: partCountRef.current,
      sourceUri,
    });
    partCountRef.current += 1;
    if (fileName != null) {
      recordingsRef.current = [...recordingsRef.current, { fileName, startMs }];
      persist('later');
      const handedOff = hasHandedOffRef.current
        ? storage.drafts.find(accountId, baseNote.draftId)
        : undefined;
      if (handedOff != null) {
        storage.drafts.save(accountId, withRecordings(handedOff, recordingsRef.current));
      }
    }
  };

  const handleSpeechEvent = useEffectEvent((event: SpeechEvent) => {
    match(event)
      .with({ type: 'start' }, () => {
        currentSegmentStartRef.current = session.getElapsedMs();
        segmentStartsRef.current = [...segmentStartsRef.current, currentSegmentStartRef.current];
      })
      .with({ type: 'result' }, (result) => {
        updateCaptions(
          applyCaptionResult(captionsRef.current, result, {
            nowMs: session.getElapsedMs(),
            segmentStartMs: currentSegmentStartRef.current,
          }),
        );
      })
      .with({ type: 'end' }, () => {
        updateCaptions(commitProvisional(captionsRef.current, session.getElapsedMs()));
      })
      .with({ type: 'recording-saved' }, ({ uri }) => {
        const [startMs = 0, ...rest] = segmentStartsRef.current;
        segmentStartsRef.current = rest;
        pendingSavesRef.current = [...pendingSavesRef.current, saveRecording(uri, startMs)];
        if (rest.length === 0) {
          notifyRecordingsArrivedRef.current?.();
        }
      })
      .with({ type: 'volume' }, { type: 'error' }, noop)
      .exhaustive();
  });

  useEffect(() => speechRecognizer.subscribe(handleSpeechEvent), [speechRecognizer]);

  const { status } = session.state;
  const flushDraft = useEffectEvent(() => {
    persist('now');
  });
  const notifyEmpty = useEffectEvent(() => {
    if (hasBegunRef.current) {
      hasBegunRef.current = false;
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

  /** Android에 이 언어 모델이 없으면 받을지 묻는다. 거절해도 네트워크 인식으로 이어 간다 */
  const offerOnDeviceModel = async (startLocale: SpeechLocale) => {
    const { canDownloadOnDeviceModel, canSaveRecording } =
      await speechRecognizer.getCapabilities(startLocale);
    savesRecordingRef.current = canSaveRecording;
    if (!canDownloadOnDeviceModel) {
      return;
    }
    const shouldDownload = await confirmDialog.open({
      title: t('voiceNote:offlineModel.title'),
      description: t('voiceNote:offlineModel.description'),
      confirmLabel: t('voiceNote:offlineModel.confirm'),
      cancelLabel: t('voiceNote:offlineModel.cancel'),
    });
    if (!shouldDownload) {
      trackEvent('voice_offline_model_requested', { locale: startLocale, result: 'declined' });
      return;
    }
    const result = await speechRecognizer.requestOfflineModel(startLocale);
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
    });
    hasBegunRef.current = hasBegun;
  };

  const mark = () => {
    haptics.selection();
    updateCaptions(withBookmark(captionsRef.current, session.getElapsedMs()));
  };

  /** 초안을 지우고 나간다(들은 글자가 없을 때) */
  const discard = () => {
    hasBegunRef.current = false;
    session.cancel();
    storage.discard(accountId, baseNote.draftId);
  };

  return {
    ...session,
    draftId: baseNote.draftId,
    /** 카드로 그릴 문장. 아직 바뀔 수 있는 마지막 문장은 `interimText`로 따로 그린다 */
    sentences: getCaptionSentences(
      { ...captions, provisional: captions.provisional.slice(0, -1) },
      0,
    ),
    interimText: getCaptionInterimText(captions),
    bookmarksMs: captions.bookmarksMs,
    start,
    mark,
    discard,
  };
}
