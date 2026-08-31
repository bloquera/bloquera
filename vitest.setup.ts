import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

vi.mock("server-only", () => ({}));

const canvasContextStub = {
  clearRect: vi.fn(),
  createLinearGradient: vi.fn(() => ({
    addColorStop: vi.fn(),
  })),
  drawImage: vi.fn(),
  fillText: vi.fn(),
  getImageData: vi.fn(() => ({
    data: new Uint8ClampedArray(4),
    height: 1,
    width: 1,
  })),
  measureText: vi.fn((text: string) => ({
    actualBoundingBoxAscent: 80,
    actualBoundingBoxDescent: 20,
    actualBoundingBoxLeft: 0,
    actualBoundingBoxRight: text.length * 40,
    width: text.length * 40,
  })),
  putImageData: vi.fn(),
  translate: vi.fn(),
};

Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
  configurable: true,
  value: vi.fn(() => canvasContextStub),
});

if (typeof document !== "undefined" && !("fonts" in document)) {
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: {
      load: vi.fn().mockResolvedValue(undefined),
      ready: Promise.resolve(),
    },
  });
}
