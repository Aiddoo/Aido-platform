import { createMockSyncStorage } from '@src/shared/__tests__';

import { createStoreReviewPromptRepository } from '../repositories/store-review-prompt.repository';
import {
  type StoreReviewDecision,
  type StoreReviewGateway,
  StoreReviewPromptService,
} from './store-review-prompt.service';

describe('StoreReviewPromptService', () => {
  const createFixture = () => {
    const storage = createMockSyncStorage();
    const values = new Map<string, string>();
    storage.getString.mockImplementation((key) => values.get(key));
    storage.set.mockImplementation((key, value) => values.set(key, value));
    const repository = createStoreReviewPromptRepository(storage);
    const gateway: jest.Mocked<StoreReviewGateway> = {
      isAvailable: jest.fn().mockResolvedValue(true),
      requestReview: jest.fn().mockResolvedValue(undefined),
    };
    const now = jest.fn(() => new Date('2026-08-12T00:00:00.000Z'));
    const service = new StoreReviewPromptService(repository, gateway, now);

    return { gateway, repository, service };
  };

  const becomeEligible = async (
    service: StoreReviewPromptService,
    decide: () => Promise<'dismiss' | 'review'>,
  ) => {
    await service.recordSuccessfulCompletion(
      { accountId: 'account-a', todoId: 1, localDate: '2026-08-10' },
      decide,
    );
    await service.recordSuccessfulCompletion(
      { accountId: 'account-a', todoId: 2, localDate: '2026-08-10' },
      decide,
    );
    return service.recordSuccessfulCompletion(
      { accountId: 'account-a', todoId: 3, localDate: '2026-08-11' },
      decide,
    );
  };

  it('기준 미달 또는 네이티브 리뷰 불가 환경에서는 앱 제안을 열지 않는다', async () => {
    const { gateway, service } = createFixture();
    const decide = jest.fn<Promise<'dismiss'>, []>().mockResolvedValue('dismiss');

    await service.recordSuccessfulCompletion(
      { accountId: 'account-a', todoId: 1, localDate: '2026-08-10' },
      decide,
    );
    gateway.isAvailable.mockResolvedValue(false);
    await service.recordSuccessfulCompletion(
      { accountId: 'account-a', todoId: 2, localDate: '2026-08-11' },
      decide,
    );
    await service.recordSuccessfulCompletion(
      { accountId: 'account-a', todoId: 3, localDate: '2026-08-11' },
      decide,
    );

    expect(decide).not.toHaveBeenCalled();
    expect(gateway.requestReview).not.toHaveBeenCalled();
  });

  it('같은 계정의 동시 완료에서는 리뷰 결정을 하나만 연다', async () => {
    // Given
    const { repository, service } = createFixture();
    repository.recordSuccessfulCompletion('account-1', {
      todoId: 1,
      localDate: '2026-07-25',
    });
    repository.recordSuccessfulCompletion('account-1', {
      todoId: 2,
      localDate: '2026-07-26',
    });
    let resolveDecision: ((decision: StoreReviewDecision) => void) | undefined;
    const decide = jest.fn(
      () =>
        new Promise<StoreReviewDecision>((resolve) => {
          resolveDecision = resolve;
        }),
    );

    // When
    const first = service.recordSuccessfulCompletion(
      { accountId: 'account-1', todoId: 3, localDate: '2026-07-26' },
      decide,
    );
    const second = service.recordSuccessfulCompletion(
      { accountId: 'account-1', todoId: 4, localDate: '2026-07-26' },
      decide,
    );
    await Promise.resolve();

    // Then
    expect(decide).toHaveBeenCalledTimes(1);
    resolveDecision?.('dismiss');
    await expect(Promise.all([first, second])).resolves.toEqual([true, false]);
  });

  it('제안을 거절하면 90일 쿨다운을 기록하고 네이티브 리뷰를 요청하지 않는다', async () => {
    const { gateway, repository, service } = createFixture();

    const offered = await becomeEligible(service, async () => 'dismiss');

    expect(offered).toBe(true);
    expect(repository.read('account-a').dismissedAt).toBe('2026-08-12T00:00:00.000Z');
    expect(gateway.requestReview).not.toHaveBeenCalled();
  });

  it('리뷰 선택은 상태를 먼저 기록한 뒤 네이티브 리뷰를 요청한다', async () => {
    const { gateway, repository, service } = createFixture();
    gateway.requestReview.mockImplementation(async () => {
      expect(repository.read('account-a').reviewRequestedAt).toBe('2026-08-12T00:00:00.000Z');
    });

    const offered = await becomeEligible(service, async () => 'review');

    expect(offered).toBe(true);
    expect(gateway.requestReview).toHaveBeenCalledTimes(1);
  });
});
