---
'@aido/server': patch
---

메일을 공식 `@nestjs/mail`(Resend 전송)로 보내고 `resend` SDK를 지운다. 같은 발송은 발송 id를 멱등 키로 한 번만 나가며, 새 전송은 Resend 태그를 보내지 않아 Resend 대시보드의 태그 필터가 비게 된다.
