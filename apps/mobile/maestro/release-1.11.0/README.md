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

## 한글 UI와 공용 시트의 추가 회귀 검증

앱이 로그인된 상태로 열린 뒤 실행한다. 설정 화면 링크는 이 flow의 준비 단계이며 cold-start
계약을 검증하는 링크가 아니다. 앱 종료 후 제품의 위젯 링크는 `widget-cold-*.yaml`에서 별도로
검증한다. `nudge-navigation-and-thanks.yaml`의 대상은 **새 콕과 아직 완료하지 않은 할 일**이어야
한다. 이 flow는 실제 답장·완료·감사 전송을 수행하므로 재실행할 때 새 QA fixture를 준비한다.

1. `nudge-navigation-and-thanks.yaml`: 받은/보낸 탭, 세 답장, 미완료 보존, 상세 이동·복귀,
   직접 완료, 감사 recipient, Android 시스템 뒤로가기, 경로 변경 시 시트 제거, 감사 전송.
2. `korean-light-gallery.yaml`: 라이트 모드의 목록·상세·기존 홈 화면을 캡처한다.
3. `korean-theme-gallery.yaml`: 다크 모드의 동일 기능과 기존 위젯 생성 링크·공용 생성 시트를
   검증한다. Android에서는 시스템 뒤로가기 후 키보드와 시트가 정리되는지도 확인한다.

스크린샷 경로는 Maestro test-output-dir 안의 상대 이름을 사용한다. 외부 절대 경로를
`takeScreenshot`에 전달하지 않는다. 테스트 출력의 metadata에는 입력 변수가 포함될 수 있으므로
공유할 때는 검토한 PNG만 복사하고 계정 정보·원본 로그는 저장소에 올리지 않는다.

iOS 상세 헤더의 Maestro 자동 탭은 해당 시뮬레이터에서 실패했다. 실제 헤더 직접 터치와 기본
가장자리 스와이프 복귀는 정상 동작했다. flow는 기본 스와이프를 사용하고 두 검증을 구분해
기록한다. 홈 위젯의 OS 설정·홈 페이지 위치는 기기별 준비 사항이므로 앱 내부 flow와 분리한다.
