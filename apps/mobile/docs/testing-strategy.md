# 모바일 테스트 전략

자동 테스트는 제품 규칙과 계약 경계에만 쓴다. 화면 동작은 실제 앱에서 확인한다. 작성 규칙·도구·명령은 [testing-guide](../.claude/testing-guide.md)가 원본이다.

## 왜 이 범위인가

- 잘못되면 사용자 결과가 달라지는 규칙은 순수 함수에 있다(Model·Policy·Mapper·view-model). 빠르고 흔들리지 않게 잠글 수 있다.
- 키보드·스크롤·레이아웃 시프트·큰 글꼴·접근성·프레임 성능은 Jest가 재현하지 못한다. mock으로 재현한 테스트는 통과해도 실기기 동작을 보장하지 않는다.
- 포트 stub은 실제 서비스·모델 코드를 돌리지만 SDK·OS 동작은 보장하지 않는다. Hermes에 없는 메서드, 기기별 인식기 차이가 그 예다.
- 테스트 개수와 커버리지 수치는 목표가 아니다.

## 자동 테스트

1. Model·Policy의 제품 규칙
2. Service·Mapper의 HTTP·Zod·모델 변환 경계
3. 자체 분기와 경계값이 있는 순수 util·view-model·공용 유틸

컴포넌트 렌더, hook·Provider, Query Options 배선은 기본 범위가 아니다. 기존 테스트가 있다는 이유로 같은 종류를 늘리지 않는다.

## 실제 앱 확인

- iOS·Android 키보드, 뒤로 가기, 스크롤 위치
- 작은 화면과 큰 글꼴의 줄바꿈과 touch target
- light·dark, VoiceOver·TalkBack, Reduce Motion
- 긴 목록의 blank frame, layout shift, 메모리, Release frame time

항목별 상세는 [UI와 native 검증](../.claude/testing-guide.md#ui와-native-검증)에 있다.
