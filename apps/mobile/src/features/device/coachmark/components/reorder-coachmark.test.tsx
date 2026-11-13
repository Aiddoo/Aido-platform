import { createTestDi } from '@src/testing/core';
import '@src/shared/i18n/init';
import { renderScreen } from '@src/testing/render';
import { screen } from '@testing-library/react-native';
import { Suspense } from 'react';

import { createCoachmarkStorage } from '../__tests__/coachmark.fixtures';
import { ReorderCoachmark } from './reorder-coachmark';

const INPUT = { accountId: 'account-1', kind: 'todo-reorder' } as const;

function NeverResolves(): never {
  throw new Promise<void>(() => {});
}

describe('ReorderCoachmark', () => {
  it('화면에 붙으면 안내를 보이고 봤음으로 저장한다', async () => {
    // Given
    const { syncStorage, records } = createCoachmarkStorage();

    // When
    await renderScreen(<ReorderCoachmark.Alert kind="todo" accountId={INPUT.accountId} />, {
      di: createTestDi({ ports: { syncStorage } }),
    });

    // Then
    expect(screen.getByText('할 일을 길게 눌러 원하는 순서로 옮길 수 있어요')).toBeTruthy();
    expect(records.hasSeen(INPUT)).toBe(true);
  });

  it('이미 본 계정에는 보이지 않는다', async () => {
    // Given
    const { syncStorage } = createCoachmarkStorage([INPUT]);

    // When
    await renderScreen(<ReorderCoachmark.Alert kind="todo" accountId={INPUT.accountId} />, {
      di: createTestDi({ ports: { syncStorage } }),
    });

    // Then
    expect(screen.queryByText('할 일을 길게 눌러 원하는 순서로 옮길 수 있어요')).toBeNull();
  });

  it('화면에 붙지 못하고 버려진 렌더는 봤음으로 저장하지 않는다', async () => {
    // Given
    const { syncStorage, records } = createCoachmarkStorage();

    // When
    await renderScreen(
      <Suspense fallback={null}>
        <ReorderCoachmark.Alert kind="todo" accountId={INPUT.accountId} />
        <NeverResolves />
      </Suspense>,
      { di: createTestDi({ ports: { syncStorage } }) },
    );

    // Then
    expect(records.hasSeen(INPUT)).toBe(false);
  });
});
