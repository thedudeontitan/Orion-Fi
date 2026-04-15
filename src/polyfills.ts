/**
 * Polyfills for browser compatibility with Algorand wallet libraries
 * and algokit-utils (which calls Buffer.* when decoding simulated ABI returns).
 */
import { Buffer } from "buffer";

// Global polyfill for Node.js globals in browser
if (typeof global === 'undefined') {
  (window as any).global = window;
}

// Buffer polyfill — algokit-utils v9 readonly ABI decoding uses Buffer in the
// browser (PerpetualDexClient.send.call -> simulate -> decode). Attach eagerly.
if (typeof (window as any).Buffer === "undefined") {
  (window as any).Buffer = Buffer;
}
if (typeof (globalThis as any).Buffer === "undefined") {
  (globalThis as any).Buffer = Buffer;
}

// Process polyfill
if (typeof process === 'undefined') {
  (window as any).process = {
    env: {},
    nextTick: (fn: Function) => setTimeout(fn, 0),
    version: '',
    browser: true,
  };
}