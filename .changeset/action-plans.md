---
'@aido/api': minor
'@aido/server': minor
---

말·글을 할 일 계획으로 바꾸는 voice 컨텍스트를 더한다. `POST /v1/quick-plans`(AI 할 일 만들기 횟수)·`POST /v1/voice-notes/digest`(말로 메모하기 횟수)는 호출 전에 예약하고 실패·빈 결과면 정확히 한 번 환불하며(빠른 계획은 할 일 0개도 환불, 녹음 정리는 요약이나 핵심 내용을 돌려주면 할 일 0개여도 차감), 같은 `Idempotency-Key`는 한 번만 차감한다. `POST /v1/action-plans/apply`는 차감 없이 사용자가 확인한 행동만 손으로 만든 할 일과 같은 경로로 한 트랜잭션에 저장하고, 메모에서 만든 계획이면 원본 메모를 지운다. 서버는 녹음도 전사 글자도 저장하지 않고 사용량과 요청 해시·만든 id만 남긴다(`PlanApplication` 테이블, `QuotaCharge.requestHash` 열 추가, 7일 정리 작업). 새 오류 코드 AI_1312·1315·1316·1317·1318. `QuotaLedger`는 같은 키의 다른 요청을 AI_1318로 거절하고, 달을 넘겨 이어받은 예약을 새 달 한도로 다시 잡는다. 녹음 정리 라우트 본문 256KB, 분당 4회·하루 30회 제한.
