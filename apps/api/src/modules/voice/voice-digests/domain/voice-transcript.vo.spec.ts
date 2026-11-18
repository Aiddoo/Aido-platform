import { VoiceTranscript } from "./voice-transcript.vo.js";

function transcript(text: string, segments: { startMs: number; text: string }[] = []) {
  return VoiceTranscript.create({
    text,
    durationSeconds: 60,
    segments: segments.map((segment) => ({ ...segment, isBookmarked: false })),
  });
}

describe("VoiceTranscript", () => {
  it("문장 목록이 전체 글자보다 길면 문장 목록으로 상한을 잰다", () => {
    // Given
    const value = transcript("짧다", [{ startMs: 0, text: "가".repeat(10) }]);

    // When
    const exceeds = value.exceeds({ maxCharacters: 9 });

    // Then
    expect(value.characterCount).toBe(10);
    expect(exceeds).toBe(true);
  });

  it("상한과 같은 글자 수는 넘지 않은 것이다", () => {
    // Given
    const value = transcript("가".repeat(10));

    // When
    const exceeds = value.exceeds({ maxCharacters: 10 });

    // Then
    expect(exceeds).toBe(false);
  });

  it("프롬프트에서 길어지는 글자는 늘어난 길이로 센다", () => {
    // Given
    const value = transcript('가<>&"\n');

    // When
    const count = value.characterCount;

    // Then
    expect(count).toBe(1 + 6 * 3 + 2 * 2);
  });

  it.each([
    { sentenceIndex: 1, startMs: 2000 },
    { sentenceIndex: 2, startMs: null },
    { sentenceIndex: null, startMs: null },
  ])("문장 번호 $sentenceIndex의 시각은 $startMs다", ({ sentenceIndex, startMs }) => {
    // Given
    const value = transcript("첫 문장 다음 문장", [
      { startMs: 0, text: "첫 문장" },
      { startMs: 2000, text: "다음 문장" },
    ]);

    // When
    const found = value.startMsAt(sentenceIndex);

    // Then
    expect(found).toBe(startMs);
  });
});
