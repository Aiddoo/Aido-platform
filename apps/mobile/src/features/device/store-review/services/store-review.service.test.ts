import { toInstant } from '@src/shared/date/instant';
import {
  createAppLifecycleGatewayStub,
  createAppStoreReviewGatewayStub,
  createMemorySyncStorage,
} from '@src/testing/core';
import { createDateKey } from '@src/testing/date-key';
import { setupFakeTimersPerTest } from '@src/testing/timers';

import { StoreReviewPolicy } from '../domains/store-review.model';
import { createStoreReviewRepository } from '../repositories/store-review.repository';
import {
  StoreReviewService,
  type WaitUntilPresentable,
  waitForSettledScreen,
} from './store-review.service';

const NOW = toInstant('2026-10-27T12:00:00.000Z');
const ACCOUNT = 'account-a';
const ALL_DONE = { accountId: ACCOUNT, moment: 'all_todos_done' } as const;
const presentable: WaitUntilPresentable = async () => true;

const createFixture = () => {
  const storage = createMemorySyncStorage();
  const repository = createStoreReviewRepository(storage);
  const gateway = createAppStoreReviewGatewayStub();
  const service = new StoreReviewService(repository, gateway, () => NOW);
  const becomeEngaged = (accountId = ACCOUNT) => {
    for (const localDate of ['2026-10-25', '2026-10-26', '2026-10-27']) {
      service.recordActiveDay(accountId, createDateKey(localDate));
    }
  };
  return { becomeEngaged, gateway, repository, service };
};

describe('StoreReviewService', () => {
  it('세 날째 할 일을 다 끝낸 순간 축하가 가라앉은 뒤 OS 리뷰 창을 요청하고 시각을 남긴다', async () => {
    // Given
    const { becomeEngaged, gateway, repository, service } = createFixture();
    becomeEngaged();
    const waitUntilPresentable = jest.fn<Promise<boolean>, [number]>().mockResolvedValue(true);
    gateway.requestReview.mockImplementation(async () => {
      expect(repository.find(ACCOUNT)?.requestedAt).toEqual([NOW]);
    });

    // When
    const outcome = await service.requestReviewAt(ALL_DONE, waitUntilPresentable);

    // Then
    expect(outcome).toBe('requested');
    expect(waitUntilPresentable).toHaveBeenCalledWith(1_200);
    expect(gateway.requestReview).toHaveBeenCalledTimes(1);
  });

  it('끝낸 날이 모자라면 기다리지도 요청하지도 않는다', async () => {
    // Given
    const { gateway, service } = createFixture();
    service.recordActiveDay(ACCOUNT, createDateKey('2026-10-27'));
    const waitUntilPresentable = jest.fn(presentable);

    // When
    const outcome = await service.requestReviewAt(ALL_DONE, waitUntilPresentable);

    // Then
    expect(outcome).toBe('not_engaged');
    expect(waitUntilPresentable).not.toHaveBeenCalled();
    expect(gateway.requestReview).not.toHaveBeenCalled();
  });

  it('네이티브 리뷰를 쓸 수 없는 환경에서는 요청하지 않는다', async () => {
    // Given
    const { becomeEngaged, gateway, service } = createFixture();
    becomeEngaged();
    gateway.isAvailable.mockResolvedValue(false);

    // When
    const outcome = await service.requestReviewAt(ALL_DONE, presentable);

    // Then
    expect(outcome).toBe('unavailable');
    expect(gateway.requestReview).not.toHaveBeenCalled();
  });

  it('기다리는 사이 화면이 내려가거나 앱이 백그라운드로 가면 요청하지 않고 다음 순간을 남겨 둔다', async () => {
    // Given
    const { becomeEngaged, gateway, repository, service } = createFixture();
    becomeEngaged();

    // When
    const interrupted = await service.requestReviewAt(ALL_DONE, async () => false);

    // Then
    expect(interrupted).toBe('interrupted');
    expect(gateway.requestReview).not.toHaveBeenCalled();
    expect(repository.find(ACCOUNT)?.requestedAt).toEqual([]);
    await expect(service.requestReviewAt(ALL_DONE, presentable)).resolves.toBe('requested');
  });

  it('같은 앱 실행에서는 다른 계정이라도 두 번 요청하지 않는다', async () => {
    // Given
    const { becomeEngaged, gateway, service } = createFixture();
    becomeEngaged('account-a');
    becomeEngaged('account-b');
    await service.requestReviewAt(ALL_DONE, presentable);

    // When
    const second = await service.requestReviewAt(
      { accountId: 'account-b', moment: 'paw_print_celebration' },
      presentable,
    );

    // Then
    expect(second).toBe('already_requested_this_session');
    expect(gateway.requestReview).toHaveBeenCalledTimes(1);
  });

  it('같은 계정의 동시 순간은 하나만 기다리고 끝나면 진행 표시를 푼다', async () => {
    // Given
    const { becomeEngaged, gateway, service } = createFixture();
    becomeEngaged();
    const waiting = Promise.withResolvers<void>();
    const ready = Promise.withResolvers<boolean>();
    const waitUntilPresentable: WaitUntilPresentable = () => {
      waiting.resolve();
      return ready.promise;
    };

    // When
    const first = service.requestReviewAt(ALL_DONE, waitUntilPresentable);
    const second = await service.requestReviewAt(ALL_DONE, waitUntilPresentable);
    await waiting.promise;
    ready.resolve(false);

    // Then
    expect(second).toBe('in_flight');
    await expect(first).resolves.toBe('interrupted');
    await expect(service.requestReviewAt(ALL_DONE, presentable)).resolves.toBe('requested');
    expect(gateway.requestReview).toHaveBeenCalledTimes(1);
  });

  it('OS 리뷰 가능 여부 확인이 실패해도 진행 표시를 풀고 실패를 호출부로 넘긴다', async () => {
    // Given
    const { becomeEngaged, gateway, repository, service } = createFixture();
    becomeEngaged();
    gateway.isAvailable.mockRejectedValueOnce(new Error('native unavailable'));

    // When
    const failed = service.requestReviewAt(ALL_DONE, presentable);

    // Then
    await expect(failed).rejects.toThrow('native unavailable');
    expect(repository.find(ACCOUNT)?.requestedAt).toEqual([]);
    await expect(service.requestReviewAt(ALL_DONE, presentable)).resolves.toBe('requested');
  });

  it('이전 버전에서 이미 리뷰를 요청받은 사용자는 120일이 지나기 전에 다시 묻지 않는다', async () => {
    // Given
    const { becomeEngaged, gateway, repository, service } = createFixture();
    becomeEngaged();
    repository.update(ACCOUNT, (state) =>
      StoreReviewPolicy.withRequest(state, toInstant('2026-08-12T00:00:00.000Z')),
    );

    // When
    const outcome = await service.requestReviewAt(ALL_DONE, presentable);

    // Then
    expect(outcome).toBe('cooling_down');
    expect(gateway.requestReview).not.toHaveBeenCalled();
  });
});

describe('waitForSettledScreen', () => {
  const DELAY_MS = 1_200;

  setupFakeTimersPerTest();

  it('축하가 가라앉을 때까지 기다린 뒤 화면이 그대로면 true로 끝나고 구독을 정리한다', async () => {
    // Given
    const appLifecycle = createAppLifecycleGatewayStub();
    const controller = new AbortController();

    // When
    const settled = waitForSettledScreen({
      delayMs: DELAY_MS,
      signal: controller.signal,
      appLifecycle,
      isScreenReady: () => true,
    });
    jest.advanceTimersByTime(DELAY_MS);

    // Then
    await expect(settled).resolves.toBe(true);
    expect(appLifecycle.getListenerCount()).toBe(0);
  });

  it('기다리는 사이 화면이 내려가면(unmount) 타이머를 지우고 false로 끝난다', async () => {
    // Given
    const appLifecycle = createAppLifecycleGatewayStub();
    const controller = new AbortController();
    const isScreenReady = jest.fn(() => true);
    const settled = waitForSettledScreen({
      delayMs: DELAY_MS,
      signal: controller.signal,
      appLifecycle,
      isScreenReady,
    });

    // When
    controller.abort();

    // Then
    await expect(settled).resolves.toBe(false);
    expect(jest.getTimerCount()).toBe(0);
    expect(appLifecycle.getListenerCount()).toBe(0);
    jest.advanceTimersByTime(DELAY_MS);
    expect(isScreenReady).not.toHaveBeenCalled();
  });

  it('기다리는 사이 앱이 백그라운드로 가면 타이머를 지우고 false로 끝난다', async () => {
    // Given
    const appLifecycle = createAppLifecycleGatewayStub();
    const settled = waitForSettledScreen({
      delayMs: DELAY_MS,
      signal: new AbortController().signal,
      appLifecycle,
      isScreenReady: () => true,
    });

    // When
    appLifecycle.emit('background');

    // Then
    await expect(settled).resolves.toBe(false);
    expect(jest.getTimerCount()).toBe(0);
    expect(appLifecycle.getListenerCount()).toBe(0);
  });

  it('기다린 뒤 시트나 키보드가 올라와 있으면 false로 끝난다', async () => {
    // Given
    const appLifecycle = createAppLifecycleGatewayStub();

    // When
    const settled = waitForSettledScreen({
      delayMs: DELAY_MS,
      signal: new AbortController().signal,
      appLifecycle,
      isScreenReady: () => false,
    });
    jest.advanceTimersByTime(DELAY_MS);

    // Then
    await expect(settled).resolves.toBe(false);
  });

  it('이미 내려간 화면이나 백그라운드에서는 타이머를 걸지 않는다', async () => {
    // Given
    const appLifecycle = createAppLifecycleGatewayStub();
    const aborted = new AbortController();
    aborted.abort();

    // When
    const fromUnmounted = waitForSettledScreen({
      delayMs: DELAY_MS,
      signal: aborted.signal,
      appLifecycle,
      isScreenReady: () => true,
    });
    appLifecycle.emit('background');
    const fromBackground = waitForSettledScreen({
      delayMs: DELAY_MS,
      signal: new AbortController().signal,
      appLifecycle,
      isScreenReady: () => true,
    });

    // Then
    await expect(fromUnmounted).resolves.toBe(false);
    await expect(fromBackground).resolves.toBe(false);
    expect(jest.getTimerCount()).toBe(0);
  });
});
