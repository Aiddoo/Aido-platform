---
'@aido/server': patch
'@aido/api': patch
---

서버 15개 Context를 한 가지 구조로 정리한다. 기능(slice)마다 Nest Module 하나·Aggregate Root 하나를 두고, 쓰기는 Entity·값 객체, 포트는 abstract class DI 토큰(`provideUseCase` 조립, Symbol 토큰·barrel 재수출 제거), 업무 오류는 slice의 이름 있는 생성 함수, 큐는 `defineQueue` 한 곳, 날짜는 `ClockPort`와 Temporal(`dayjs` 제거), 설정은 namespace config로 읽는다. 이름·경계·순환·미사용 코드는 ls-lint·dependency-cruiser·관례 검사·knip이 `pnpm check`에서 막는다. `@aido/api`는 엔티티 ID 규칙을 `ENTITY_ID_PATTERN`(`^c[0-9a-z]{8,63}$`) 하나로 두어 `z.cuid()`를 대신하고(운영 ID 모양과 출시 앱 요청은 그대로 통과한다), 표준 커서 목록 `cursorPageSchema`로 할 일·친구 할 일·메모·주간 성취 목록을 만들며(JSON Schema 출력은 바이트 단위로 같다), 쓰지 않는 follow 계약 별칭과 `weeklyAchievementSchema` export를 지운다. 출시 앱 OpenAPI 지문은 ID pattern만 갱신했고 HTTP 응답 모양·오류 코드·큐 이름·잡 키는 그대로다.
