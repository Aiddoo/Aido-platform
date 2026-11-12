---
'@aido/api': patch
'@aido/server': patch
---

인증 코드 재발송 대기(`VERIFY_0753`, 429)의 `details.remainingSeconds`를 운영 응답에도 싣는다. 전에는 서버가 값을 만들었지만 `PUBLIC_ERROR_DETAILS`에 등록되지 않아 운영 필터가 지웠고, 값도 남은 시간이 아니라 상수 60초였다. 이제 같은 종류 코드의 마지막 발급 시각에서 남은 초(1~60, 정수)를 계산한다. `@aido/api/errors`에 `verificationResendCooldownErrorDetailsSchema`와 `hasPublicErrorDetails`를 더한다. 상태·코드·문구는 그대로이고 `details`만 새로 실린다. 출시 앱(1.15.1 이하)도 이 값을 읽어 다시 보내기 타이머를 켠다.
