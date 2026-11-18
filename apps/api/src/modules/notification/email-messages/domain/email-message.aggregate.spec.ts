import type { EmailKind } from "./email-delivery.constants.js";
import { EmailMessageId } from "./email-message-id.vo.js";
import { EmailMessage } from "./email-message.aggregate.js";

const params = {
  id: EmailMessageId.reconstitute("message-1"),
  kind: "verification" as const,
  to: "recipient@test.com",
  subject: "Subject",
  html: "<p>Body</p>",
  text: "Body",
  tags: [{ name: "type", value: "verification" }],
};
describe("EmailMessage", () => {
  it.each(["to", "subject"])("빈 %s는 기존 SYS_0002 규칙으로 거절한다", (field) => {
    // When
    const create = () => EmailMessage.create({ ...params, [field]: " " });

    // Then
    expect(create).toThrow();
  });
  it("메일 종류 목록에 없는 종류는 SYS_0002로 거절한다", () => {
    // Given
    // 큐에서 꺼낸 값처럼 타입 검사를 거치지 않은 종류다
    const kind: EmailKind = JSON.parse('"unknown"');

    // When
    const create = () => EmailMessage.create({ ...params, kind });

    // Then
    expect(create).toThrow();
  });
  it("입력 및 반환 태그의 변경이 검증된 메시지를 바꾸지 않는다", () => {
    // Given
    const tags = [{ name: "type", value: "verification" }];
    const message = EmailMessage.create({ ...params, tags });

    // When
    if (tags[0] != null) {
      tags[0].value = "changed";
    }
    const output = message.tags;
    if (output[0] != null) {
      Object.assign(output[0], { value: "changed-again" });
    }

    // Then
    expect(message.tags).toEqual([{ name: "type", value: "verification" }]);
    expect(message.id.value).toBe("message-1");
  });
  it("꺼낸 값은 발송 건 id와 렌더한 본문을 담고 태그를 복사해 돌려준다", () => {
    // Given
    const message = EmailMessage.create(params);

    // When
    const primitives = message.toPrimitives();

    // Then
    expect(primitives).toEqual({
      id: "message-1",
      kind: "verification",
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
      tags: params.tags,
    });
    expect(primitives.tags).not.toBe(message.tags);
  });
  it("같은 발송 건 id의 메일은 같은 메일이다", () => {
    // When
    const first = EmailMessage.create(params);
    const recreated = EmailMessage.create({ ...params, subject: "Other" });

    // Then
    expect(first.equals(recreated)).toBe(true);
  });
});
