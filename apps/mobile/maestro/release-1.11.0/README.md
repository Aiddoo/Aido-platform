# 1.11.0 Native Release QA

Docker 개발 API와 동일한 native Release 앱을 사용한다. 스토어 제출용 production artifact는 운영 API를 사용하므로 QA fixture와 구분한다. 계정 비밀번호·token은 repository에 저장하지 않는다.

## 입력

Maestro의 `-e`로 입력한다. 일반 shell 환경 변수만 설정하면 flow 변수가 전달되지 않는다.

| 변수                                  | 의미                                       |
| ------------------------------------- | ------------------------------------------ |
| `QA_EMAIL`, `QA_PASSWORD`             | 임시 FREE 또는 ACTIVE 계정                 |
| `QA_NUDGE_ID`                         | 현재 친구가 오늘 공개 할 일에 보낸 찌르기  |
| `QA_TODO_ID`, `QA_TODO_TITLE`         | 대상 할 일 id와 제목                       |
| `QA_FRIEND_NAME`                      | 감사 recipient의 표시 이름                 |
| `QA_PREVIOUS_DATE`, `QA_PREVIOUS_DAY` | 사용자 현지 날짜 기준 전날 ISO 날짜와 일자 |
| `QA_PENDING_TODO_TITLE`               | 오늘에만 있는 미완료 할 일 제목            |

## 순서

1. `login.yaml`: 각 플랫폼에서 FREE/ACTIVE 계정으로 각각 로그인한다.
2. `nudge-replies.yaml`: 세 답장을 변경한다. API에서 완료 상태와 첫 답장 알림 수를 함께 확인한다.
3. `nudge-thanks.yaml`: 직접 완료 후 preview/recipient/감사 전송을 확인한다. 중복 감사 알림과 완료 취소·재완료의 유일성은 PostgreSQL integration/E2E에서 확인한다.
4. `widget-cold-create.yaml`, `widget-cold-todo.yaml`: 로그인된 앱을 종료하고 초기 링크를 복원한다.
5. `theme-dark.yaml`, `date-navigation.yaml`: 테마·고정 날짜·오늘 복귀를 확인한다.
6. Android gallery flows 또는 iOS 홈의 실제 위젯 gallery에서 소/중/대 위젯을 등록한다. 이 OS 영역은 플랫폼 언어에 맞춰 수동 확인한다.

iOS widget gallery 결과는 접근성 label이 없는 항목이 있어서 화면 제어 도구로 확인한다. 앱 내부의 생성·상세 이동은 양 플랫폼에서 동일한 Maestro flow로 검증한다. 각 OS의 테마가 widget environment에 반영된 상태에서 두 발바닥·완료 수·행·생성 버튼을 확인한다.

## 검증 범위

시뮬레이터의 ACTIVE fixture는 실제 결제/스토어 영수증 검증을 대신하지 않는다. 자정·DST·background cleanup은 LocalDateProvider와 순수 시계 테스트에서 검증한다. live clock을 바꾸어 인증서·token 만료 또는 서버 시간에 영향을 주지 않는다.

결과와 실제 Before/After는 [클라이언트 릴리스 문서](../../docs/releases/1.11.0-client.md)에 기록한다.
