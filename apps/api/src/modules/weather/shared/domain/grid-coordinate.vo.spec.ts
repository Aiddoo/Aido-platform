/**
 * GridCoordinate 값 객체 단위 테스트
 */
import { GridCoordinate } from "./grid-coordinate.vo.js";

describe("GridCoordinate — 저장 격자 값 객체", () => {
  it("격자 좌표를 생성하고 getter로 노출한다", () => {
    // When
    const grid = GridCoordinate.create(60, 127);

    // Then
    expect(grid.gridX).toBe(60);
    expect(grid.gridY).toBe(127);
  });

  it.each([
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    Number.MAX_SAFE_INTEGER + 1,
  ])("정확한 정수로 저장할 수 없는 격자를 거부한다: %p", (value) => {
    // When
    const createWithGridX = () => GridCoordinate.create(value, 127);
    const createWithGridY = () => GridCoordinate.create(60, value);

    // Then
    expect(createWithGridX).toThrow(
      expect.objectContaining({ errorCode: "SYS_0002", details: { field: "gridX", value } }),
    );
    expect(createWithGridY).toThrow(
      expect.objectContaining({ errorCode: "SYS_0002", details: { field: "gridY", value } }),
    );
  });

  describe("equals", () => {
    it("동일 격자면 true", () => {
      // When
      const isEqual = GridCoordinate.create(60, 127).equals(GridCoordinate.create(60, 127));

      // Then
      expect(isEqual).toBe(true);
    });

    it("gridX가 다르면 false", () => {
      // When
      const isEqual = GridCoordinate.create(60, 127).equals(GridCoordinate.create(61, 127));

      // Then
      expect(isEqual).toBe(false);
    });

    it("gridY가 다르면 false", () => {
      // When
      const isEqual = GridCoordinate.create(60, 127).equals(GridCoordinate.create(60, 128));

      // Then
      expect(isEqual).toBe(false);
    });
  });
});
