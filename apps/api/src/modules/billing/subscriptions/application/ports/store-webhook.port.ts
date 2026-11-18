import type { StoreSubscriptionEvent } from "../../domain/store-subscription.event.js";

/** 웹훅 요청 헤더. 이름은 소문자다. */
export type StoreWebhookHeaders = Readonly<Record<string, string | readonly string[] | undefined>>;

/**
 * 결제 공급자 웹훅의 인증과 번역. 원문 모양·서명 방식은 공급자 어댑터만 알고, 컨트롤러는 이 포트가 만든
 * 공급자 중립 이벤트를 ApplyStoreSubscriptionEventUseCase에 넘긴다.
 */
export abstract class StoreWebhookPort {
  /** 공급자가 보낸 요청이 아니면 false이고, 호출부가 SUBSCRIPTION_1601로 거절한다. */
  abstract authenticate(headers: StoreWebhookHeaders): boolean;
  /**
   * 원문을 공급자 중립 이벤트로 바꾼다. 다시 보내도 결과가 같아 받은 것으로 닫을 원문(계약과 다른 모양,
   * 반영하지 않는 테스트 결제)은 로그·경보를 남기고 null이다.
   */
  abstract translate(body: unknown): StoreSubscriptionEvent | null;
}
