---
'@aido/api': minor
'@aido/server': minor
---

AI 프롬프트를 작업마다 `PromptDefinition`(id·버전·Zod 출력 schema·build·normalize) 하나로 정리하고, 캐시 친화 순서(고정 system → 동적 context → 맨 끝 사용자 입력)와 공용 보안 규칙·언어 정책(할 일 제목은 말한 언어, 요약은 앱 언어)을 kit으로 묶는다. v1 프롬프트 폴더와 `AI_PROMPT_VERSION_*` 전환 env를 지우고 버전 이름을 `parse-todo@3`처럼 바꾼다(출시 응답의 선택 `meta.promptVersion` 값만 달라진다). 빠른 계획·녹음 정리 프롬프트와 격주·매월 반복 표현을 미리 정의하고 `ACTION_PLAN_LIMITS`를 `@aido/api/vocabulary`에 더하며, 쓰지 않던 `llmParsedResultSchema`·`llmParsedMemoResultSchema`를 지운다. golden(ko·en·혼합)과 `pnpm ai:eval --task --provider` 수동 평가를 더한다.
