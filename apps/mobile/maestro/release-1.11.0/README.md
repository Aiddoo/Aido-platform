# 1.11.0 Native Release QA

Docker 개발 API와 동일한 native Release 앱을 사용한다. 새 답장·감사 시나리오에는 QA 서버의 `NUDGE_INTERACTIONS_ENABLED=true`가 필요하다. 운영 기본값은 false로 유지한다. 스토어 제출용 production artifact는 운영 API를 사용하므로 QA fixture와 구분한다. 계정 비밀번호·token은 repository에 저장하지 않는다.

## 입력

Maestro의 `-e`로 입력한다. 일반 shell 환경 변수만 설정하면 flow 변수가 전달되지 않는다.

| 변수                                      | 의미                                       |
| ----------------------------------------- | ------------------------------------------ |
| `QA_EMAIL`, `QA_PASSWORD`                 | 임시 FREE 또는 ACTIVE 계정                 |
| `QA_NUDGE_ID`                             | 현재 친구가 오늘 공개 할 일에 보낸 찌르기  |
| `QA_TODO_ID`, `QA_TODO_TITLE`             | 대상 할 일 id와 제목                       |
| `QA_FRIEND_NAME`                          | 감사 recipient의 표시 이름                 |
| `QA_PAGING_TODO_ID`, `QA_PAGING_NUDGE_ID` | 완료한 공개 할 일과 응원 친구 22명의 콕    |
| `QA_UNAVAILABLE_NUDGE_ID`                 | 공개 범위가 바뀐 할 일의 콕                |
| `QA_PREVIOUS_DATE`, `QA_PREVIOUS_DAY`     | 사용자 현지 날짜 기준 전날 ISO 날짜와 일자 |
| `QA_PENDING_TODO_TITLE`                   | 오늘에만 있는 미완료 할 일 제목            |
| `QA_WIDGET_WEEK_TITLE`                    | 현지 날짜에 맞는 주간 제목                 |

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
4. `nudge-paged-thanks.yaml`: 첫 페이지 20명·전체 22명, 시트 내부 추가 로딩, 캐시 갱신 후 성공 화면 보존과 완료 버튼을 확인한다.
5. `nudge-unavailable-and-search.yaml`: 공개 범위 변경 안내, 친구 검색의 입력 전·빈 결과·입력 초기화를 확인한다.
6. `english-copy-gallery.yaml`: 영어 카탈로그의 목록·답장·감사 문구와 다크 모드를 확인하고 한국어로 돌아온다.

감사 시트는 화면 일부만 스크롤된다. `nudge-paged-thanks.yaml`은 Maestro 공식 [부분 화면 스크롤 가이드](https://docs.maestro.dev/examples/recipes/custom-scrolling-for-screen-fragments)에 따라 목록 내부를 swipe하고 마지막 친구를 assert한다. 전체 화면용 `scrollUntilVisible`이 시트 바깥을 움직이는 실패를 제품의 페이지 로딩 오류와 구분한다.

스크린샷 경로는 Maestro test-output-dir 안의 상대 이름을 사용한다. 외부 절대 경로를
`takeScreenshot`에 전달하지 않는다. 테스트 출력의 metadata에는 입력 변수가 포함될 수 있으므로
공유할 때는 검토한 PNG만 복사하고 계정 정보·원본 로그는 저장소에 올리지 않는다.

뒤로가기 접근성 label은 `뒤로 가기`다. 자동화의 정규식은 `뒤로 ?가기`로 두 형태를 허용한다. iOS에서는 기본 가장자리 스와이프 복귀도 따로 확인한다. 홈 위젯의 OS 설정·홈 페이지 위치는 기기별 준비 사항이므로 앱 내부 flow와 분리한다.

## 종료 상태 링크 검증

`stopApp`과 `am force-stop`은 Android에서 앱을 stopped 상태로 만든다. Android 15부터 이 상태는 모든 PendingIntent를 취소하므로 실제 메모리 회수와 같은 조건으로 취급하지 않는다. [Android 공식 동작 변경](https://developer.android.com/about/versions/15/behavior-changes-all#stopped-state)을 따른다.

URI 직접 진입, 실행 중 실제 홈 위젯 터치, 프로세스만 종료한 retained-task 진입을 따로 검증한다. `am kill`은 cached/background process만 종료하며 launcher의 widget ContentProvider 참조로 프로세스가 유지될 수 있다. PID가 남으면 cold-start 통과로 기록하지 않는다.

최종 QA Release는 별도 `/tmp` CNG snapshot에만 공식 `withAndroidManifest`로 `android:debuggable=true`를 설정한다. 앱의 Release `BuildConfig.DEBUG=false`와 embedded bundle을 유지하면서 `run-as <package> kill -9 <확인한 PID>`로 프로세스만 종료한다. tap 직전 PID 부재, 동일 `MainActivity`의 `ActivityRecord`, launcher PID 유지, 기존 widget ID/provider를 확인한다. production CNG와의 manifest 차이가 이 QA flag 하나뿐인지 기록하며 production에는 이 설정을 포함하지 않는다. `am crash`, `stop-app`, 태스크 강제 초기화는 retained-task 조건의 대체 검증이 아니다.

`android-widget-entry.yaml`은 이 준비 조건을 실제로 확인한 뒤 실행한다. Home 전환은 `waitForAnimationToEnd`로 마친 다음 프로세스를 종료하고 즉시 실제 홈 위젯을 터치한다. 재렌더 전후 동일 행·날짜·생성 버튼도 반복해서 눌러야 한다.

0.22.1의 direct click에서 [공식 이슈 #154](https://github.com/sAleksovski/react-native-android-widget/issues/154)와 일치하는 launcher `ActivityNotFoundException`을 확인했다. 최종 renderer는 기존 카드 전체를 공식 `ListWidget`의 단일 항목으로 감싸 Android collection template/fill-in 경로를 사용한다. native source와 vendor patch는 수정하지 않는다. 실제 10회 데이터 갱신 후 template 수·기존 ID·7날짜·4행·생성 터치를 확인한다. 사용되지 않는 clock token의 일부 세대가 남는 것과 실제 클릭 실패·무한 누적을 구분해서 기록한다.

background의 native openURL은 동작 없는 feed wake만 수행한다. 정확한 목적지는 계정별 command에서 auth-ready entry가 복원한다. 로그아웃 시 기존 위젯은 로그인 안내로 바뀌고, 다른 계정으로 로그인하면 이전 목록이 남지 않는지 확인한다.

감사 전송의 성공 화면은 공용 시트 내부에서 확인하고 완료 버튼으로 닫는다. 배경의 상세가 갱신되는 것과 별도로 시트의 성공·오류·재시도 흐름을 검증한다. 받은 콕은 알림 목록에 통합되어 이전 받은 콕 URL도 알림 화면으로 이동해야 한다.
