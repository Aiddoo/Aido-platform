# 모바일 테스트 전략

자동 테스트는 제품 규칙과 계약 경계에만 쓴다. 화면 동작은 실제 앱에서 확인한다. 작성 규칙·도구·명령은 [testing-guide](../.claude/testing-guide.md)가 원본이다.

## 왜 이 범위인가

- 잘못되면 사용자 결과가 달라지는 규칙은 순수 함수에 있다(Model·Policy·Mapper·view-model). 빠르고 흔들리지 않게 잠글 수 있다.
- 키보드·스크롤·레이아웃 시프트·큰 글꼴·접근성·프레임 성능은 Jest가 재현하지 못한다. mock으로 재현한 테스트는 통과해도 실기기 동작을 보장하지 않는다.
- 포트 stub은 실제 서비스·모델 코드를 돌리지만 SDK·OS 동작은 보장하지 않는다. Hermes에 없는 메서드, 기기별 인식기 차이가 그 예다.
- 테스트 개수와 커버리지 수치는 목표가 아니다.

## 자동 테스트

클라이언트 테스트는 유저 엣지 케이스와 중요한 비즈니스 로직만 둔다.

- **쓴다:** Policy와 업무 순수 함수의 규칙·경계값, 돈·권한·한도·시간대·자정·서머타임, 초안과 입력값 보존, 오프라인·서버 500·토큰 만료, 두 번 누름, 삭제된 대상, 다른 계정 섞임, 저장 값·공개 링크 호환, 재현된 버그.
- **쓰지 않는다:** 단순 세터, 필드 그대로 옮기는 mapper, 표시만 하는 컴포넌트, 라이브러리 동작, 스타일과 스냅샷, 구현 세부(호출 횟수만 보는 테스트), 커버리지를 채우려는 테스트, hook·Provider·Query Options의 단순 배선.

기존 테스트가 "쓰지 않는다"에 들면 사유를 적어 지워도 된다. 테스트가 줄어도 좋다. 단 규칙을 지키던 테스트를 형식 때문에 지우지 않는다. 기존 테스트가 있다는 이유로 같은 종류를 늘리지 않는다.

## 테스트 구조

- 서비스 단위는 실제 Service에 포트 stub을 끼운다. 화면은 `renderUi` + `createTestDi` + `createHttpClientStub`이다. 공용 도구는 `src/shared/__tests__`에 포트마다 하나씩 있다(이름은 `create{Port}Stub`, `create{Port}Fake`, `createMemory{X}`).
- `jest.mock`은 `shared/infra` 어댑터 테스트의 SDK에만 쓴다.
- 테스트끼리 상태를 나누지 않는다. stub, fake, `QueryClient`, 저장소는 테스트마다 새로 만들고 fake timer는 되돌린다. `test:random`(`jest --randomize`)을 통과해야 한다.

## 실제 앱 확인

- iOS·Android 키보드, 뒤로 가기, 스크롤 위치
- 작은 화면과 큰 글꼴의 줄바꿈과 touch target
- light·dark, VoiceOver·TalkBack, Reduce Motion
- 긴 목록의 blank frame, layout shift, 메모리, Release frame time

항목별 상세는 [UI와 native 검증](../.claude/testing-guide.md#ui와-native-검증)에 있다.
