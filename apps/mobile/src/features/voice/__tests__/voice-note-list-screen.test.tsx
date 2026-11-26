import '@src/shared/i18n/init';
import { createUser } from '@src/features/identity/user/__tests__/user.fixtures';
import { USER_QUERY_KEYS } from '@src/features/identity/user/queries/user-query-keys';
import { toInstant } from '@src/shared/date/instant';
import {
  createAnalyticsStub,
  createHttpClientStub,
  createMemoryKeyValueStorage,
  createTestDi,
  createTestQueryClient,
  createVoiceNoteStorageFake,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { router } from 'expo-router';

import VoiceNoteListScreen from '../../../../app/(app)/voice-notes/index';
import { createSpokenVoiceNote, createVoiceNoteDigest } from './voice-note.fixtures';

const ACCOUNT_ID = 'user-1';

async function renderDraftList(notes: ReturnType<typeof createSpokenVoiceNote>[]) {
  const httpClient = createHttpClientStub();
  httpClient.get.mockReturnValue(new Promise(() => undefined));
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  queryClient.setQueryData(USER_QUERY_KEYS.me(), createUser({ id: ACCOUNT_ID }));
  const analytics = createAnalyticsStub();
  const voice = createVoiceNoteStorageFake();
  const di = createTestDi({
    ports: {
      httpClient,
      queryClient,
      analytics,
      storage: createMemoryKeyValueStorage(),
      ...voice.ports,
    },
  });
  for (const note of notes) {
    di.voiceNoteDraftRepository.save(ACCOUNT_ID, note);
  }

  await renderScreen(<VoiceNoteListScreen />, { di, withLocalDate: true, withOverlay: true });

  return { di, analytics, httpClient };
}

function getDraftRow(title: string) {
  const row = screen
    .getAllByTestId('voice-note-draft')
    .find((candidate) => within(candidate).queryByText(title) != null);
  if (row == null) {
    throw new Error(`[voice-note-list-screen] 제목이 "${title}"인 초안 줄이 없습니다`);
  }

  return row;
}

const RECORDED = createSpokenVoiceNote({
  draftId: 'draft-recorded',
  createdAt: toInstant('2026-11-02T00:00:00.000Z'),
});
const DIGESTED = createSpokenVoiceNote({
  draftId: 'draft-digested',
  createdAt: toInstant('2026-11-01T00:00:00.000Z'),
  digest: createVoiceNoteDigest({ title: '온보딩 회의' }),
});

describe('VoiceNoteListScreen', () => {
  describe('말로 남긴 메모 목록', () => {
    it('기기에 남은 초안을 보여 주고 정리 전인 메모만 정리 전이라고 표시한다', async () => {
      // When
      await renderDraftList([RECORDED, DIGESTED]);

      // Then
      expect(await screen.findAllByTestId('voice-note-draft')).toHaveLength(2);
      expect(within(getDraftRow('온보딩 회의')).queryByText('정리 전')).toBeNull();
      expect(within(getDraftRow('말로 남긴 메모')).getByText('정리 전')).toBeOnTheScreen();
    });

    it('초안을 누르면 그 초안의 화면을 한 번 연다', async () => {
      // Given
      await renderDraftList([DIGESTED]);

      // When
      await fireEvent.press(await screen.findByTestId('voice-note-draft'));

      // Then
      expect(router.navigate).toHaveBeenCalledTimes(1);
      expect(router.navigate).toHaveBeenCalledWith({
        pathname: '/voice-notes/[draftId]',
        params: { draftId: 'draft-digested' },
      });
    });

    it('삭제를 확인하면 그 초안과 녹음만 기기에서 지우고 삭제 이벤트를 한 번 보낸다', async () => {
      // Given
      const { di, analytics } = await renderDraftList([RECORDED, DIGESTED]);
      await screen.findAllByTestId('voice-note-draft');

      // When
      await fireEvent(getDraftRow('온보딩 회의'), 'accessibilityAction', {
        nativeEvent: { actionName: 'delete' },
      });
      await screen.findByText('이 메모를 삭제할까요?');
      await fireEvent.press(screen.getByRole('button', { name: '삭제' }));

      // Then
      await waitFor(() => expect(screen.getAllByTestId('voice-note-draft')).toHaveLength(1));
      expect(di.voiceNoteDraftRepository.find(ACCOUNT_ID, 'draft-digested')).toBeNull();
      expect(di.voiceNoteDraftRepository.find(ACCOUNT_ID, 'draft-recorded')).not.toBeNull();
      expect(analytics.trackEvent).toHaveBeenCalledTimes(1);
      expect(analytics.trackEvent).toHaveBeenCalledWith('voice_note_deleted', {
        is_digested: true,
      });
    });

    it('삭제를 취소하면 아무것도 지우지 않는다', async () => {
      // Given
      const { di, analytics } = await renderDraftList([DIGESTED]);

      // When
      await fireEvent(await screen.findByTestId('voice-note-draft'), 'accessibilityAction', {
        nativeEvent: { actionName: 'delete' },
      });
      await screen.findByText('이 메모를 삭제할까요?');
      await fireEvent.press(screen.getByRole('button', { name: '취소' }));

      // Then
      await waitFor(() => expect(screen.queryByText('이 메모를 삭제할까요?')).toBeNull());
      expect(di.voiceNoteDraftRepository.find(ACCOUNT_ID, 'draft-digested')).not.toBeNull();
      expect(analytics.trackEvent).not.toHaveBeenCalled();
    });
  });
});
