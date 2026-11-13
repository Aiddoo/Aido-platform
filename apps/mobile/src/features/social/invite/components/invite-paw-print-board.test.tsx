import { createUser } from '@src/features/identity/user/__tests__/user.fixtures';
import '@src/shared/i18n/init';
import { USER_QUERY_KEYS } from '@src/features/identity/user/queries/user-query-keys';
import { readStoredValue, writeStoredValue } from '@src/shared/storage/define-stored-value';
import {
  createHapticsGatewayStub,
  createMemoryObservableSyncStorage,
  createTestQueryClient,
  createTestDi,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { screen } from '@testing-library/react-native';
import { Suspense } from 'react';

import { createInvite } from '../__tests__/invite.fixtures';
import { INVITE_QUERY_KEYS } from '../queries/invite-query-keys';
import { pawPrintCelebrationStoredValue } from '../schemas/paw-print-celebration-storage.schema';
import { InvitePawPrintBoard } from './invite-paw-print-board';

const USER_ID = 'user-1';

async function renderBoard({
  qualifiedCount,
  celebratedCount,
}: {
  qualifiedCount: number;
  celebratedCount: number;
}) {
  const syncStorage = createMemoryObservableSyncStorage();
  writeStoredValue(syncStorage, pawPrintCelebrationStoredValue, celebratedCount, USER_ID);
  const haptics = createHapticsGatewayStub();
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  queryClient.setQueryData(USER_QUERY_KEYS.me(), createUser({ id: USER_ID }));
  queryClient.setQueryData(INVITE_QUERY_KEYS.me(), createInvite({ qualifiedCount }));

  await renderScreen(
    <Suspense fallback={null}>
      <InvitePawPrintBoard />
    </Suspense>,
    { di: createTestDi({ ports: { syncStorage, haptics, queryClient } }), withLocalDate: true },
  );
  await screen.findAllByRole('image');

  const readCelebratedCount = () =>
    readStoredValue(syncStorage, pawPrintCelebrationStoredValue, USER_ID);

  return { readCelebratedCount, haptics };
}

describe('InvitePawPrintBoard 새 발자국 축하', () => {
  it('새 발자국이 있으면 진동을 한 번 주고 본 수를 저장한다', async () => {
    // When
    const { readCelebratedCount, haptics } = await renderBoard({
      qualifiedCount: 3,
      celebratedCount: 1,
    });

    // Then
    expect(haptics.notify).toHaveBeenCalledTimes(1);
    expect(haptics.notify).toHaveBeenCalledWith('success');
    expect(readCelebratedCount()).toBe(3);
  });

  it('이미 본 수와 같으면 진동 없이 그대로 둔다', async () => {
    // When
    const { readCelebratedCount, haptics } = await renderBoard({
      qualifiedCount: 2,
      celebratedCount: 2,
    });

    // Then
    expect(haptics.notify).not.toHaveBeenCalled();
    expect(readCelebratedCount()).toBe(2);
  });

  it('발자국이 줄었으면 진동 없이 본 수만 맞춘다', async () => {
    // When
    const { readCelebratedCount, haptics } = await renderBoard({
      qualifiedCount: 1,
      celebratedCount: 3,
    });

    // Then
    expect(haptics.notify).not.toHaveBeenCalled();
    expect(readCelebratedCount()).toBe(1);
  });
});
