import { test } from "node:test";
import assert from "node:assert/strict";
import { detectDevice } from "../../lib/device";

const UA = {
  iphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  androidPhone: "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36",
  androidTablet: "Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  ipadLegacy: "Mozilla/5.0 (iPad; CPU OS 12_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
  ipadDesktopMode: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  windows: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
};

test("detecta celular, tablet e desktop", () => {
  assert.equal(detectDevice(UA.iphone), "mobile");
  assert.equal(detectDevice(UA.androidPhone), "mobile");
  assert.equal(detectDevice(UA.androidTablet), "tablet");
  assert.equal(detectDevice(UA.ipadLegacy), "tablet");
  assert.equal(detectDevice(UA.windows), "desktop");
  assert.equal(detectDevice(UA.ipadDesktopMode, 0), "desktop"); // Mac de verdade (sem toque)
  assert.equal(detectDevice(UA.ipadDesktopMode, 5), "tablet"); // iPad em modo desktop: o toque desempata
  assert.equal(detectDevice(null), "desktop");
});
