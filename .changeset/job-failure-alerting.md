---
'@aido/server': patch
---

배경 작업 실패를 사람에게 알린다. 작업이 재시도를 모두 쓰고 실패하면(DLQ 이동·잘못된 payload 포함) `job.failed:<queue>:<errorType>` 운영 경보를 올리고, 재시도가 남은 실패는 로그만 남긴다. 15분마다 도는 `schedule-watchdog.v1`이 pg-boss에 등록된 모든 스케줄을 실제 예정 시각으로 보고 마지막 두 예정 실행 안에 끝난 실행이 없으면 `schedule.overdue`, 실패만 있으면 `schedule.failing`, 최근 15분 DLQ 유입이 있으면 `queue.dead-letter` 경보를 올린다. 감시 작업은 실행마다 Sentry Crons 모니터 `aido-job-worker`(코드 상수)에 check-in해 worker·pg-boss가 통째로 멈추면 Sentry가 알린다(production·DSN이 있을 때만). 모든 운영 경보는 key의 첫 경보를 늘 보내고 같은 key는 시간당 한 번, 다시 보내는 경보는 프로세스 전체에서 시간당 2건까지만 보내 Sentry 무료 플랜 오류 한도(월 5,000건)를 지킨다. 경보 태그에는 큐·작업 종류·시도 횟수·오류 클래스만 싣는다. HTTP 계약·DB 스키마·기존 큐 이름·잡 키·env는 그대로다.
