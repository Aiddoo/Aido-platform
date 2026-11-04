---
'@aido/api': minor
'@aido/server': minor
---

할 일 생성 포트를 커밋 후 실행 `StagedTodoCreatorPort.stage` 하나로 통일한다. 메모 전환과 AI 제안 수락이 같은 경로를 쓰므로 롤백되면 알림·캐시 효과가 남지 않는다. `TodoSchedule`이 종일과 시간을 맞춘다(시간이 있으면 시간 일정, 없으면 종일). 출시 앱이 종일과 시간을 함께 보내도 서버가 맞춰 저장한다. 반복 할 일 오류 코드 `TODO_0841`~`TODO_0846`과 공개 상세, 시스템 상한 `TODO_SERIES_LIMITS`를 더하고, 반복에 맞는 날짜가 없으면 `SYS_0002` 대신 `TODO_0843`을 돌려준다.
