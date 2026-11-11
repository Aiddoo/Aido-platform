import { createUser } from '@src/features/identity/user/__tests__/user.fixtures';
import { UserService } from '@src/features/identity/user/apis/user.service';
import '@src/shared/i18n/init';
import { USER_QUERY_KEYS } from '@src/features/identity/user/queries/user-query-keys';
import { LocalDateProvider } from '@src/shared/providers/local-date-provider';
import { OverlayProvider } from '@src/shared/ui';
import {
  createAnalyticsStub,
  createErrorReporterStub,
  createHapticsGatewayStub,
  createHttpClientStub,
  createLocalFileSystemFake,
  createVoiceNoteStorageFake,
  createTestQueryClient,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import VoiceStorageRoute from '../../../../app/(app)/(tabs)/(mypage)/settings/voice-storage';
import { createVoiceNoteDigest, createSpokenVoiceNote } from './voice-note.fixtures';

const ACCOUNT_ID = 'user-1';
const OWNER_DIRECTORY = ['voice-notes', ACCOUNT_ID];

async function renderVoiceStorage({
  hasRecording = true,
  hasOrphanFile = false,
}: { hasRecording?: boolean; hasOrphanFile?: boolean } = {}) {
  const files = createLocalFileSystemFake();
  const storage = createVoiceNoteStorageFake(files);
  if (hasRecording) {
    files.addFile(OWNER_DIRECTORY, 'draft-1-0.wav', { sizeBytes: 2_500_000 });
    storage.drafts.save(
      ACCOUNT_ID,
      createSpokenVoiceNote({
        digest: createVoiceNoteDigest({ title: '주간 회의' }),
        recordings: [{ fileName: 'draft-1-0.wav', startMs: 0 }],
      }),
    );
  }
  if (hasOrphanFile) {
    files.addFile(OWNER_DIRECTORY, 'failed-0.wav', { sizeBytes: 4_096 });
  }
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  queryClient.setQueryData(USER_QUERY_KEYS.me(), createUser({ id: ACCOUNT_ID }));

  await renderScreen(
    <LocalDateProvider>
      <OverlayProvider>
        <VoiceStorageRoute />
      </OverlayProvider>
    </LocalDateProvider>,
    {
      queryClient,
      di: {
        userService: new UserService(createHttpClientStub()),
        ...storage.di,
        analytics: createAnalyticsStub(),
        errorReporter: createErrorReporterStub(),
        haptics: createHapticsGatewayStub(),
      },
    },
  );

  return { storage, files };
}

describe('녹음 저장 공간', () => {
  it('전체 용량과 메모별 녹음 용량을 보여 준다', async () => {
    // Given
    await renderVoiceStorage();

    // When
    const total = await screen.findByTestId('voice-storage-total');

    // Then
    expect(total).toHaveTextContent('2.5 MB');
    expect(screen.getByText('주간 회의')).toBeTruthy();
  });

  it('녹음이 없으면 없다고 알리고 삭제 버튼을 숨긴다', async () => {
    // Given
    await renderVoiceStorage({ hasRecording: false });

    // When
    const empty = await screen.findByTestId('voice-storage-empty');

    // Then
    expect(empty).toBeTruthy();
    expect(screen.queryByTestId('voice-storage-remove-all')).toBeNull();
  });

  it('메모에 속하지 않은 파일만 있으면 용량도 0이고 비어 있다고 알린다', async () => {
    // Given
    await renderVoiceStorage({ hasRecording: false, hasOrphanFile: true });

    // When
    const empty = await screen.findByTestId('voice-storage-empty');

    // Then
    expect(empty).toBeTruthy();
    expect(screen.getByTestId('voice-storage-total')).toHaveTextContent('0 KB');
    expect(screen.queryByTestId('voice-storage-remove-all')).toBeNull();
  });

  it('확인을 누르면 녹음만 삭제하고 들은 내용과 요약은 남는다', async () => {
    // Given
    const { storage, files } = await renderVoiceStorage();
    fireEvent.press(await screen.findByTestId('voice-storage-remove')).catch(jest.fn());

    // When
    await fireEvent.press(await screen.findByText('삭제'));

    // Then
    await waitFor(() =>
      expect(screen.getByTestId('voice-storage-total')).toHaveTextContent('0 KB'),
    );
    const note = storage.drafts.find(ACCOUNT_ID, 'draft-1');
    expect(note?.recordings).toEqual([]);
    expect(note?.digest?.title).toBe('주간 회의');
    expect(note?.sentences).toHaveLength(1);
    expect(files.hasFile(OWNER_DIRECTORY, 'draft-1-0.wav')).toBe(false);
  });

  it('확인 창에서 취소하면 아무것도 지우지 않는다', async () => {
    // Given
    const { files } = await renderVoiceStorage();
    fireEvent.press(await screen.findByTestId('voice-storage-remove')).catch(jest.fn());

    // When
    await fireEvent.press(await screen.findByText('취소'));

    // Then
    expect(files.hasFile(OWNER_DIRECTORY, 'draft-1-0.wav')).toBe(true);
    expect(screen.getByTestId('voice-storage-total')).toHaveTextContent('2.5 MB');
  });
});
