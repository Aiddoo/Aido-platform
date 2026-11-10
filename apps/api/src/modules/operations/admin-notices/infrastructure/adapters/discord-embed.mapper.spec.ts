import type { AdminNotificationSeverity } from "../../application/read-models/admin-notification.read-model.js";
import { renderDiscordEmbed } from "./discord-embed.mapper.js";

const AT = "2026-10-08T00:00:00.000Z";

describe("renderDiscordEmbed", () => {
  it.each([
    ["info", 0x5865f2],
    ["success", 0x57f287],
    ["warning", 0xf1c40f],
    ["critical", 0xe74c3c],
  ] as const satisfies readonly (readonly [AdminNotificationSeverity, number])[])(
    "%s 등급은 Discord 색 %i로 바꾼다",
    (severity, color) => {
      // Given
      const notification = { title: "제목", body: "본문", severity };

      // When
      const embed = renderDiscordEmbed({ type: "message", message: notification }, AT);

      // Then
      expect(embed.color).toBe(color);
    },
  );

  it("시각 값은 Discord 타임스탬프로 바꾸고 텍스트 값은 그대로 둔다", () => {
    // Given
    const iso = "2026-07-11T00:00:00.000Z";

    // When
    const embed = renderDiscordEmbed(
      {
        type: "message",
        message: {
          title: "제목",
          body: "본문",
          severity: "info",
          fields: [
            { label: "시각", value: { kind: "datetime", iso }, inline: false },
            { label: "이름", value: { kind: "text", text: "아이도" } },
          ],
        },
      },
      AT,
    );

    // Then
    expect(embed.fields).toEqual([
      { name: "시각", value: `<t:${Math.floor(Date.parse(iso) / 1_000)}:f>`, inline: false },
      { name: "이름", value: "아이도" },
    ]);
  });

  it("읽을 수 없는 시각은 <t:NaN:f> 대신 원문을 그대로 보여 준다", () => {
    // Given
    const notification = {
      title: "제목",
      body: "본문",
      severity: "info",
      fields: [{ label: "시각", value: { kind: "datetime", iso: "not-a-date" } }],
    } as const;

    // When
    const embed = renderDiscordEmbed({ type: "message", message: notification }, AT);

    // Then
    expect(embed.fields).toEqual([{ name: "시각", value: "not-a-date" }]);
  });

  it("링크가 없으면 url 칸을 만들지 않고 필드가 없으면 빈 배열을 보낸다", () => {
    // When
    const embed = renderDiscordEmbed(
      { type: "message", message: { title: "제목", body: "본문", severity: "info" } },
      AT,
    );

    // Then
    expect(embed).toEqual({
      title: "제목",
      description: "본문",
      color: 0x5865f2,
      fields: [],
      timestamp: AT,
    });
  });
});
