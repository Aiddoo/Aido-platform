/**
 * 포트 mock 팩토리 모음
 *
 * @suites/unit은 Symbol 토큰으로 주입된 포트를 auto-mock하지 못하므로
 * (클래스 프로토타입이 없어 메서드 스텁 생성 불가) 포트별 mock 팩토리를 여기에 둡니다.
 * 팩토리는 포트 인터페이스를 반환하며, 포트 확장 시 누락을 타입 에러로 잡습니다.
 * 개별 메서드 mock API는 spec에서 `jest.mocked(mock.method)`로 접근합니다.
 */
export * from "./cross-module.mock";
export * from "./retention-repository.mock";
export * from "./todo-read-repository.mock";
export * from "./todo-repository.mock";
export * from "./unit-of-work.mock";
