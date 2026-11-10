import { EmailMessage } from "./email-message.vo.js";

const props = {
  kind: "verification" as const,
  to: "recipient@test.com",
  subject: "Subject",
  html: "<p>Body</p>",
  text: "Body",
  tags: [{ name: "type", value: "verification" }],
  idempotencyKey: "message-1",
};
describe("EmailMessage", () => {
  it.each(["to", "subject"])("빈 %s는 기존 SYS_0002 규칙으로 거절한다", (field) => {
    expect(() => EmailMessage.create({ ...props, [field]: " " })).toThrow();
  });
  it("입력 및 반환 태그의 변경이 검증된 메시지 snapshot을 바꾸지 않는다", () => {
    const tags = [{ name: "type", value: "verification" }];
    const message = EmailMessage.create({ ...props, tags });
    if (tags[0] != null) {
      tags[0].value = "changed";
    }
    const output = message.tags;
    if (output[0] != null) {
      Object.assign(output[0], { value: "changed-again" });
    }
    expect(message.tags).toEqual([{ name: "type", value: "verification" }]);
    expect(message.idempotencyKey).toBe("message-1");
  });
  it("큐에 담을 값에는 멱등 키를 싣지 않고 태그를 복사해 돌려준다", () => {
    // Given
    const message = EmailMessage.create(props);

    // When
    const primitives = message.toPrimitives();

    // Then
    expect(primitives).toEqual({
      kind: "verification",
      to: props.to,
      subject: props.subject,
      html: props.html,
      text: props.text,
      tags: props.tags,
    });
    expect(primitives.tags).not.toBe(message.tags);
  });
  it("큐에서 복원한 메시지는 같은 값의 새 메시지와 같다", () => {
    // When
    const restored = EmailMessage.reconstitute(props);

    // Then
    expect(restored.equals(EmailMessage.create(props))).toBe(true);
  });
});
