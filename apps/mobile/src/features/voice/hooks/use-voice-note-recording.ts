import {
  useErrorReporter,
  useIdGenerator,
  useOfflineModelPromptRepository,
  useSpeechRecognizer,
  useVoiceNoteStorageService,
} from '@src/bootstrap/providers/di-context';
import type { SpeechLocale } from '@src/core/ports/speech-recognizer';
import { useTrack } from '@src/shared/analytics';
import { getNowInstant } from '@src/shared/date/instant';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { t } from '@src/shared/i18n';
import { useConfirmDialog } from '@src/shared/ui';
import { noop } from 'es-toolkit';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { match } from 'ts-pattern';

import { VoiceRecordingIntake } from '../apis/voice-recording-intake';
import type { VoiceCaptureEntry } from '../constants/voice.events';
import { VoiceNotePolicy } from '../domains/voice-note.model';
import { type VoiceNote } from '../schemas/voice-note.schema';
import { useSpeechEvent } from './use-speech-event';
import { useVoiceCaptureSession } from './use-voice-capture-session';
import { useVoiceNoteCaptions } from './use-voice-note-captions';

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
  const idGenerator = useIdGenerator();

  const [seedNote] = useState(() =>
    seedDraftId == null ? undefined : storage.drafts.find(accountId, seedDraftId),
  );
  const [baseNote] = useState<VoiceNote>(
    () =>
      seedNote ??
      VoiceNotePolicy.createVoiceNote({
        draftId: idGenerator.create(),
        locale,
        createdAt: getNowInstant(),
      }),
  );
  const [intake] = useState(
    () =>
      new VoiceRecordingIntake({
        accountId,
        draftId: baseNote.draftId,
        storage,
        onRecordingSaved: () => persist('later'),
      }),
  );
  const currentSegmentStartRef = useRef(0);
  const hasBegunRef = useRef(false);
  const isUnmountedRef = useRef(false);

  const onCaptured = async () => {
    await intake.waitUntilSettled();
    persist('now');
    intake.handOff();
    hasBegunRef.current = false;
    // 끝내는 동안 사용자가 이미 떠났다. 글자는 저장했고 다른 화면에서 끌어오지 않는다
    if (!isUnmountedRef.current) {
      onFinished(baseNote.draftId);
    }
    return null;
  };

  const session = useVoiceCaptureSession({
    entry,
    mode: 'note',
    maxSeconds,
    onLimitReached,
    onCaptured,
  });

  const captions = useVoiceNoteCaptions({
    seedNote,
    getElapsedMs: session.getElapsedMs,
    onChange: () => persist('later'),
  });

  const toNote = (): VoiceNote => {
    const nowMs = session.getElapsedMs();
    return VoiceNotePolicy.withRecordings(
      VoiceNotePolicy.withSentences(baseNote, captions.getSentencesAt(nowMs), nowMs),
      intake.getRecordings(),
    );
  };

  function persist(timing: 'later' | 'now') {
    if (!intake.ownsDraft()) {
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
      intake.listenForLate((listener) => speechRecognizer.subscribe(listener));
    };
  }, [intake, speechRecognizer]);

  const { status } = session.state;
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
    if (status === 'paused' || status === 'failed') {
      flushDraft();
    }
    // 듣기를 시작한 뒤 처음으로 돌아왔다면 들은 글자 없이 끝난 것이다
    if (status === 'idle') {
      notifyEmpty();
    }
  }, [status]);

  /** 확인을 기다리는 사이 화면이 내려갔거나 초안을 지웠다. 묻지도 듣지도 않는다 */
  const isStartAbandoned = () => isUnmountedRef.current || intake.isDiscarded();

  const offerOnDeviceModel = useOfflineModelOffer(accountId, isStartAbandoned);

  const start = async ({
    startLocale,
    contextualStrings,
  }: {
    startLocale: SpeechLocale;
    contextualStrings: readonly string[];
  }) => {
    await offerOnDeviceModel(startLocale);
    if (isStartAbandoned()) {
      return;
    }
    const hasBegun = await session.begin({
      locale: startLocale,
      contextualStrings,
      recordingDirectory: storage.recordings.prepareDirectory(accountId),
      seed: seedNote == null ? undefined : VoiceNotePolicy.toCaptureSeed(seedNote),
    });
    hasBegunRef.current = hasBegun;
  };

  const discard = () => {
    hasBegunRef.current = false;
    session.cancel();
    intake.discard();
  };

  return {
    ...session,
    draftId: baseNote.draftId,
    sentences: captions.sentences,
    interimText: captions.interimText,
    hasText: captions.hasText,
    bookmarksMs: captions.bookmarksMs,
    markCount: captions.markCount,
    start,
    mark: captions.mark,
    discard,
  };
}

/**
 * Android에 이 언어 모델이 없으면 받을지 한 번만 묻는다. 거절하거나 시스템 창에서 취소했거나(결과를 알려주지 않는다)
 * 받을 수 없으면 그 언어는 다시 묻지 않고 네트워크 인식으로 이어 간다.
 */
function useOfflineModelOffer(accountId: string, isAbandoned: () => boolean) {
  const speechRecognizer = useSpeechRecognizer();
  const offlineModelPrompt = useOfflineModelPromptRepository();
  const toast = useAppToast();
  const confirmDialog = useConfirmDialog();
  const errorReporter = useErrorReporter();
  const { trackEvent } = useTrack();

  return async (startLocale: SpeechLocale) => {
    const { canDownloadOnDeviceModel } = await speechRecognizer.getCapabilities(
      startLocale,
      'note',
    );
    if (isAbandoned()) {
      return;
    }
    if (!canDownloadOnDeviceModel || offlineModelPrompt.hasDeclined(accountId, startLocale)) {
      return;
    }
    const shouldDownload = await confirmDialog.open({
      title: t('voiceNote:offlineModel.title'),
      description: t('voiceNote:offlineModel.description'),
      confirmLabel: t('voiceNote:offlineModel.confirm'),
      cancelLabel: t('voiceNote:offlineModel.cancel'),
    });
    if (isAbandoned()) {
      return;
    }
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
}
