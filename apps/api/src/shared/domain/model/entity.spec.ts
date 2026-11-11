import { EntityId } from "./entity-id.js";
import { Entity } from "./entity.js";

class NoteId extends EntityId<number> {
  static reconstitute(value: number): NoteId {
    return new NoteId(value);
  }
}

interface NoteProps {
  title: string;
}

class Note extends Entity<NoteId, NoteProps> {
  static reconstitute(id: number, title: string): Note {
    return new Note(NoteId.reconstitute(id), { title });
  }

  get title(): string {
    return this.props.title;
  }
}

class Draft extends Entity<NoteId, NoteProps> {
  static reconstitute(id: number, title: string): Draft {
    return new Draft(NoteId.reconstitute(id), { title });
  }
}

describe("Entity — 엔티티 베이스", () => {
  it("상태가 달라도 id가 같으면 같은 엔티티다", () => {
    // Given
    const before = Note.reconstitute(1, "장보기");
    const after = Note.reconstitute(1, "장보기: 우유");

    // When
    const isEqual = before.equals(after);

    // Then
    expect(isEqual).toBe(true);
  });

  it("상태가 같아도 id가 다르면 다른 엔티티다", () => {
    // Given
    const first = Note.reconstitute(1, "장보기");
    const second = Note.reconstitute(2, "장보기");

    // When
    const isEqual = first.equals(second);

    // Then
    expect(isEqual).toBe(false);
  });

  it("id 값이 같아도 엔티티 클래스가 다르면 다르다", () => {
    // Given
    const note = Note.reconstitute(1, "장보기");
    const draft = Draft.reconstitute(1, "장보기");

    // When
    const isEqual = note.equals(draft);

    // Then
    expect(isEqual).toBe(false);
  });
});
