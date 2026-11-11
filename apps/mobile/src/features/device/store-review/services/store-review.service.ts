import type { AppStoreReviewGateway } from '@src/core/ports/app-store-review-gateway';
import type { DateKey } from '@src/shared/date/date-key';
import { type Instant } from '@src/shared/date/instant';

import {
  createEmptyStoreReviewState,
  type StoreReviewEligibility,
  type StoreReviewMoment,
  StoreReviewPolicy,
} from '../domains/store-review.model';
import type { StoreReviewRepository } from '../repositories/store-review.repository';

export type StoreReviewOutcome =
  | 'requested'
  | Exclude<StoreReviewEligibility, 'eligible'>
  | 'already_requested_this_session'
  | 'in_flight'
  | 'unavailable'
  | 'interrupted';

/** 축하 화면의 애니메이션이 끝난 뒤 시스템 창이 뜨도록 순간마다 기다릴 시간 */
const SETTLE_DELAY_MS = {
  all_todos_done: 1_200,
  paw_print_celebration: 1_500,
} as const satisfies Record<StoreReviewMoment, number>;

/** 축하 화면이 가라앉을 때까지 기다린다. 그사이 화면을 떠나거나 앱이 백그라운드로 가면 false */
export type WaitUntilPresentable = (delayMs: number) => Promise<boolean>;

interface RequestReviewInput {
  accountId: string;
  moment: StoreReviewMoment;
}

// App Store 5.6.1·Google Play 인앱 리뷰 지침상 앱 자체 확인 창 없이 OS 리뷰 창만 요청하고, 띄울지는 OS가 정한다
export class StoreReviewService {
  readonly #repository: StoreReviewRepository;
  readonly #gateway: AppStoreReviewGateway;
  readonly #now: () => Instant;
  readonly #inFlightAccounts = new Set<string>();
  /** 서비스는 앱 프로세스마다 하나라 한 번 요청한 실행 안에서는 다시 묻지 않는다 */
  #hasRequestedThisSession = false;

  constructor(
    repository: StoreReviewRepository,
    gateway: AppStoreReviewGateway,
    now: () => Instant,
  ) {
    this.#repository = repository;
    this.#gateway = gateway;
    this.#now = now;
  }

  /** 할 일을 하나라도 끝낸 날을 남긴다. 하루에 몇 개를 끝냈는지는 세지 않는다 */
  recordActiveDay = (accountId: string, localDate: DateKey): void => {
    this.#repository.update(accountId, (state) =>
      StoreReviewPolicy.withActiveDay(state, localDate),
    );
  };

  requestReviewAt = async (
    { accountId, moment }: RequestReviewInput,
    waitUntilPresentable: WaitUntilPresentable,
  ): Promise<StoreReviewOutcome> => {
    if (this.#hasRequestedThisSession) {
      return 'already_requested_this_session';
    }
    if (this.#inFlightAccounts.has(accountId)) {
      return 'in_flight';
    }
    const eligibility = StoreReviewPolicy.getEligibility(
      this.#repository.find(accountId) ?? createEmptyStoreReviewState(),
      this.#now(),
    );
    if (eligibility !== 'eligible') {
      return eligibility;
    }

    this.#inFlightAccounts.add(accountId);
    try {
      if (!(await this.#gateway.isAvailable())) {
        return 'unavailable';
      }
      if (!(await waitUntilPresentable(SETTLE_DELAY_MS[moment]))) {
        return 'interrupted';
      }
      // 기다리는 사이 다른 계정의 요청이 먼저 나갔을 수 있다
      if (this.#hasRequestedThisSession) {
        return 'already_requested_this_session';
      }
      // OS가 창을 띄우는지는 알 수 없다. 앱이 도중에 종료돼도 다시 묻지 않도록 요청 전에 기록한다
      this.#repository.update(accountId, (state) =>
        StoreReviewPolicy.withRequest(state, this.#now()),
      );
      this.#hasRequestedThisSession = true;
      await this.#gateway.requestReview();
      return 'requested';
    } finally {
      this.#inFlightAccounts.delete(accountId);
    }
  };
}
