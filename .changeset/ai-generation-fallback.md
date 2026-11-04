---
'@aido/api': minor
'@aido/server': minor
---

AI 생성을 포트 하나(`AiGeneratorPort`)와 업체별 어댑터(Anthropic Claude·Google Gemini·OpenAI)로 바꾸고, 설정 순서(`AI_PROVIDER_ORDER`, 기본 Claude→Gemini→OpenAI)·사용자가 동의한 안내 버전·회로 상태로 업체를 골라 차례로 시도한다. Claude 크레딧 소진(402)·인증 실패는 결제 회로를 15분 열고 Sentry로 알리며, 연속 장애는 30초 건너뛴다. AI 데이터 처리 동의에 새 안내 버전 2026-11-04(글자만 세 업체로 전송, 녹음 파일은 기기에만)를 더하고 업체 표 `AI_DATA_SHARING_CONSENT_PROVIDERS`를 공유한다. 1.13·1.14 앱의 2026-10-26 동의는 다시 묻지 않고 Gemini만 쓴다. 환불한 AI 실패(AI_1301·AI_1302·AI_1310)는 공개 상세 `{ charged: false }`를 싣고 문구를 사용자 말로 고쳤다(코드·상태는 그대로). `ai-fallback`과 `AI_MODEL_<TASK>`·`AI_FALLBACK_MODEL` env를 지우고 업체별 키·모델·작업별 제한 시간·회로 env를 더한다.
