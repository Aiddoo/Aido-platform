/**
 * 포트 mock 팩토리 모음
 *
 * @suites/unit은 Symbol 토큰으로 주입된 포트를 auto-mock하지 못하므로
 * (클래스 프로토타입이 없어 메서드 스텁 생성 불가) 포트별 mock 팩토리를 여기에 둡니다.
 * 팩토리 반환 타입을 Mocked<XxxPort>로 강제해 포트 확장 시 타입 에러로 누락을 방지합니다.
 */
export * from "./transaction-manager.mock";
