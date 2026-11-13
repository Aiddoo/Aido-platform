# support 용어집

문의 기능을 설계·리뷰할 때 읽는다. 쓰는 법은 [용어집](../glossary.md)이다.

| 용어      | 코드                                  | 뜻                                                                                      |
| --------- | ------------------------------------- | --------------------------------------------------------------------------------------- |
| 문의      | `Inquiry`(Aggregate)                  | 사용자가 고객센터에 보내는 글. 저장하지 않고 담당자에게 전달하는 동안만 있다            |
| 문의 유형 | `InquiryCategory`                     | `BUG_REPORT`·`FEATURE_REQUEST`·`PAYMENT`·`OTHER`. 전달 문구에는 한국어 라벨을 붙인다    |
| 문의 내용 | `InquiryContent`(VO)                  | `INQUIRY_CONTENT_LIMITS` 길이 안의 원문. 담당자가 그대로 읽으므로 공백을 다듬지 않는다  |
| 접수      | `CreateInquiryUseCase`                | 문의를 만들고 바로 전달한다. 전달이 거절되면 `INQUIRY_1501`로 알려 사용자가 다시 보낸다 |
| 전달      | `InquiryMailerPort.deliver`           | 담당 채널(지금은 이메일)로 한 번 보낸다. 결과는 `sent`·`rejected` 값이다                |
| 제출 시각 | `submittedAt`, `formatSubmittedAtKst` | 접수한 시각. 담당자가 한국에서 읽으므로 KST로 적는다                                    |

문의는 상태가 없다(만들고 전달하면 끝난다).
