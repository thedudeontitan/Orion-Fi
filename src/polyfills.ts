/**
 * Polyfills for browser compatibility with Algorand wallet libraries
 */

// Global polyfill for Node.js globals in browser
if (typeof global === 'undefined') {
  (window as any).global = window;
}

// Buffer polyfill if needed (will be handled by Vite)

// Process polyfill
if (typeof process === 'undefined') {
  (window as any).process = {
    env: {},
    nextTick: (fn: Function) => setTimeout(fn, 0),
    version: '',
    browser: true,
  };
}