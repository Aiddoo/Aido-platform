/** 운영 알림에 붙일 결제 공급자 고객 화면 주소. 주소 모양은 공급자 어댑터만 안다. */
export abstract class StoreCustomerConsolePort {
  /** 공급자 프로젝트 설정이 없어 화면을 열 수 없으면 null이다. */
  abstract customerUrlOf(appUserId: string): string | null;
}
