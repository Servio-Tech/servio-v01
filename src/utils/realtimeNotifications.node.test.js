import assert from "node:assert/strict";
import test from "node:test";
import { playRealtimeNotification, unlockRealtimeNotifications } from "./realtimeNotifications.js";

test("unlocks and reuses audio context before playing realtime alerts", async () => {
  const previousWindow = globalThis.window;
  let contextCount = 0;
  let resumeCount = 0;
  let oscillatorStarts = 0;

  class MockAudioContext {
    constructor() {
      contextCount += 1;
      this.state = "suspended";
      this.currentTime = 0;
      this.destination = {};
    }

    resume() {
      resumeCount += 1;
      this.state = "running";
      return Promise.resolve();
    }

    createGain() {
      return {
        gain: {
          setValueAtTime() {},
          exponentialRampToValueAtTime() {},
        },
        connect() {},
      };
    }

    createOscillator() {
      return {
        frequency: { setValueAtTime() {} },
        connect() {},
        start() { oscillatorStarts += 1; },
        stop() {},
      };
    }
  }

  globalThis.window = { AudioContext: MockAudioContext };
  try {
    assert.equal(await unlockRealtimeNotifications(), true);
    playRealtimeNotification("order");
    playRealtimeNotification("waiter");

    assert.equal(contextCount, 1);
    assert.equal(resumeCount, 1);
    assert.equal(oscillatorStarts, 2);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});
