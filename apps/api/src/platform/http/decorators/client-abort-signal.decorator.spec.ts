import { EventEmitter } from "node:events";

import { abortOnClientDisconnect } from "./client-abort-signal.decorator.js";

class FakeResponse extends EventEmitter {
  readonly writableFinished: boolean;

  constructor(writableFinished: boolean) {
    super();
    this.writableFinished = writableFinished;
  }
}

describe("abortOnClientDisconnect", () => {
  it("응답을 끝내기 전에 연결이 닫히면 취소한다", () => {
    // Given
    const response = new FakeResponse(false);
    const signal = abortOnClientDisconnect(response);
    // When
    response.emit("close");
    // Then
    expect(signal.aborted).toBe(true);
  });

  it("응답을 다 보낸 뒤 닫히면 취소하지 않는다", () => {
    // Given
    const response = new FakeResponse(true);
    const signal = abortOnClientDisconnect(response);
    // When
    response.emit("close");
    // Then
    expect(signal.aborted).toBe(false);
  });
});
