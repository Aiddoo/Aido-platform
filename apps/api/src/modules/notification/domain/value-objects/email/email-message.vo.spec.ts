import { EmailMessage } from "./email-message.vo.js";

const props = {
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
    if (tags[0] !== undefined) {
      tags[0].value = "changed";
    }
    const output = message.tags;
    if (output[0] !== undefined) {
      Object.assign(output[0], { value: "changed-again" });
    }
    expect(message.tags).toEqual([{ name: "type", value: "verification" }]);
    expect(message.idempotencyKey).toBe("message-1");
  });
  it("태그를 붙이면 원본 메시지는 유지된다", () => {
    const message = EmailMessage.create(props);
    const tag = { name: "environment", value: "test" };
    const tagged = message.withTag(tag);
    tag.value = "changed";
    expect(message.tags).toHaveLength(1);
    expect(tagged.tags).toEqual([...props.tags, { name: "environment", value: "test" }]);
  });
});
