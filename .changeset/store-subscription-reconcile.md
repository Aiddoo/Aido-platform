---
'@aido/server': minor
---

구독 웹훅을 신호로 보고 스토어 상태를 다시 읽어 맞춘다. 처리 원장에 새로 기록된 웹훅마다 `store-subscription-reconcile.v1` 잡(1분 구간마다 사용자당 하나)을 같은 트랜잭션에 넣고, RevenueCat REST v2 구독 검색으로 체인 행의 만료·자동 갱신·체험·상품을 맞추며, 스토어가 접근을 주지 않는 행(놓친 환불·만료, Play 요금제 교체로 남은 옛 체인)은 끝낸다. 바뀐 것이 있을 때만 프리미엄을 다시 계산하고 캐시를 비운다. 새 선택 env `REVENUECAT_API_V2_SECRET_KEY`(읽기 전용 v2 키)와 `REVENUECAT_PROJECT_ID`가 있어야 켜진다.
