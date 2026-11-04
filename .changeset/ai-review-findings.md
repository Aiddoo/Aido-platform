---
'@aido/server': minor
---

AI 리뷰에서 찾은 결함을 고친다. Gemini의 일반 429("check your plan and billing details")를 결제 소진으로 잘못 봐 모든 동의자가 15분간 막히던 분류를 고치고, Claude 400 크레딧 소진·OpenAI 200 거절(refusal)·본문 없는 출력 상한 응답을 맞는 종류로 나눈다. 회로가 잠깐 열린 경우(`CIRCUIT_OPEN`)는 리포트·제안 잡이 다시 시도하고, 시험 호출이 끝나기를 기다리지 않으며, 앞 업체가 시간을 쓴 뒤의 `TIMEOUT`과 호출자 취소는 장애로 세지 않고, 결제 실패는 SDK 재시도에서 뺀다. 프로세스가 죽어 남은 RESERVED는 10분 주기 잡(`quota-abandoned-refund.v1`)이 멱등하게 돌려주고, 환불이 저장되지 않으면 `charged:false`를 주장하지 않으며, 확정 뒤 한도 읽기 실패는 결과를 살리고 `featureQuota`만 뺀다. `/health`의 `outbound`는 `degraded`만 공개하고, ADMIN은 사용자 일 AI 예산에서 빠지며, 계정 영구 삭제 때 `OutboundUsage`의 사용자 행을 함께 지운다. 배열·객체 칸을 JSON 문자열로 보낸 LLM 응답을 풀어서 받고, 고유명사 교정·달 이름 월말·이어 하는 일 규칙을 고쳐 프롬프트 버전을 올린다(`parse-todo@5`·`parse-memo@5`·`quick-plan@4`·`voice-note-digest@4`). 계획 프롬프트의 모델 출력은 객체 유니온 대신 `todos`·`memo`로 나눈다. HTTP 계약과 오류 코드는 그대로다.
