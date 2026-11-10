---
'@aido/server': patch
---

AI 제안·리포트 디스패치가 Drizzle 1.0 RC에서 첫 페이지의 `id: undefined` 조건으로 실패해 아무도 등록하지 못하던 문제를 고친다(1.15.0부터). 매일 AI 제안은 07:30 KST 한 번 대신 매시 정각 디스패치가 사용자 현지 07시대(10시 전까지 따라잡기)인 사용자를 고르고, 같은 현지 날짜에는 한 번만 분석한다(서울 외 사용자는 전환하는 날 하루를 건너뛸 수 있다). 제안 알림은 `copyKey`·`copyFacts`를 실어 알림함이 요청 언어로 그린다. 메모 나누기의 "이번 주말 X"는 새 앱이 읽는 `repeat`에서 토요일 한 번(`repeat`·`endDate` null)이고 출시 앱의 `isRecurring`·`recurrence`는 그대로다. Sentry AI span에 입력·지시·응답 문장을 싣지 않고(Sentry 11 기본값은 싣는다) 릴리스를 `aido-server@<version>`으로 남긴다. AI 동의 확인은 동의 시각이 지금 이전인지도 본다. 리포트·제안 목록은 같은 시각이면 id 내림차순이다. 리포트 매시 스케줄은 배포로 빠진 실행을 한 번만 보정한다. parse-todo·parse-memo의 남은 횟수 선검사는 access `@RequireQuota("AI_PLAN")`로 옮겼고 동의 확인이 먼저이며 오류 코드·상세는 같다. HTTP 계약·오류 코드·큐 이름·잡 키는 그대로다.
