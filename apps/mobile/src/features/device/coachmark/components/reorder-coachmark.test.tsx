import '@src/shared/i18n/init';
import { createCoachmarkRepository } from '@src/features/device/coachmark/apis/coachmark.repository';
import { CoachmarkService } from '@src/features/device/coachmark/apis/coachmark.service';
import { createMemorySyncStorage } from '@src/shared/__tests__';
import { renderUi } from '@src/shared/__tests__/render-ui';
import { screen } from '@testing-library/react-native';
import { Suspense } from 'react';

import { ReorderCoachmark } from './reorder-coachmark';

const INPUT = { accountId: 'account-1', kind: 'todo-reorder' } as const;

function createService() {
  return new CoachmarkService(createCoachmarkRepository(createMemorySyncStorage()));
}

function NeverResolves(): never {
  throw new Promise<void>(() => {});
}

describe('ReorderCoachmark', () => {
  it('화면에 붙으면 안내를 보이고 봤음으로 저장한다', async () => {
    // Given
    const coachmarkService = createService();

    // When
    await renderUi(<ReorderCoachmark.Contents kind="todo" accountId={INPUT.accountId} />, {
      di: { coachmarkService },
    });

    // Then
    expect(screen.getByText('할 일을 길게 눌러 원하는 순서로 옮길 수 있어요')).toBeTruthy();
    expect(coachmarkService.isPending(INPUT)).toBe(false);
  });

  it('이미 본 계정에는 보이지 않는다', async () => {
    // Given
    const coachmarkService = createService();
    coachmarkService.complete(INPUT);

    // When
    await renderUi(<ReorderCoachmark.Contents kind="todo" accountId={INPUT.accountId} />, {
      di: { coachmarkService },
    });

    // Then
    expect(screen.queryByText('할 일을 길게 눌러 원하는 순서로 옮길 수 있어요')).toBeNull();
  });

  it('화면에 붙지 못하고 버려진 렌더는 봤음으로 저장하지 않는다', async () => {
    // Given
    const coachmarkService = createService();

    // When
    await renderUi(
      <Suspense fallback={null}>
        <ReorderCoachmark.Contents kind="todo" accountId={INPUT.accountId} />
        <NeverResolves />
      </Suspense>,
      { di: { coachmarkService } },
    );

    // Then
    expect(coachmarkService.isPending(INPUT)).toBe(true);
  });
});
