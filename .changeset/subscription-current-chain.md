---
'@aido/server': patch
---

`/me`의 `premiumPlanType`·`premiumIsTrial`·`premiumPeriodEndsAt`·`willRenew`를 현재 체인(유효한 스토어 체인 중 가장 늦게 시작한 체인)으로 정한다. Play에서 요금제를 바꿔 옛 체인이 원래 만료까지 남아 있어도 새 체인의 요금제·만료·갱신을 보인다. 프리미엄 끝(`premiumEndsAt`)과 쌓아 둔 보상의 시작은 지금처럼 유효한 모든 체인의 끝까지 본다. 연간 갱신 안내도 같은 규칙으로 현재 체인에만 보낸다.
