---
'@aido/server': patch
---

서버가 바로 만들던 `ApplicationException`·`DomainException` 265곳을 slice `<slice>.errors.ts`의 이름 있는 생성 함수로 옮기고(거부는 `application/`, 불변식은 `domain/`), 그 밖에서 바로 만드는 것을 Oxlint `aido/no-inline-coded-exception`으로 막는다. 응답의 코드·HTTP 상태·문구·details는 그대로다.
