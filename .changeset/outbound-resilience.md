---
'@aido/server': minor
---

외부 호출 보호를 공용 `OutboundPolicy`(회로·bulkhead·시도별 timeout)로 모으고 AI 비용 장치를 더한다. AI 생성은 입력 상한·킬 스위치(`AI_GENERATION_MODE`)·전역·사용자 비용 예산(`AI_BUDGET_*`, `OutboundUsage` 테이블)을 업체 호출 전에 확인하고, 작업 분류별 동시 호출·요청당 모델 호출 상한·앞 업체 시도별 제한 시간·동시 같은 요청 합치기를 둔다. 예산·킬 스위치로 멈추면 AI_1301·AI_1310에 `{ charged: false }`로 응답한다. 제안 잡은 일시 장애만 다시 시도한다. WeatherKit의 직접 만든 장애 차단을 공용 회로로 바꾸고 월 호출을 계량하며, 기상청·에어코리아·KASI에 회로를 달고 단건 예보를 합치며, Expo 호출에 30초 제한을 둔다. 운영 경보는 `OperationalAlertPort` 하나로 합친다. 모든 LLM 출력 schema를 업체 공통 규칙(전 칸 required, 없으면 null)으로 바꾸고 OpenAI strict·Gemini structuredOutputs·Claude JSON 도구를 켜며, Claude 캐시 기준을 512토큰으로 낮추고 캐시 토큰·단가를 비용에 반영한다. HTTP 계약과 오류 코드는 그대로다.
