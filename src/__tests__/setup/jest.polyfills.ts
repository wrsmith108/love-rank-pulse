/**
 * Jest Polyfills for Node.js Environment
 * Required for MSW v2 and other browser APIs
 */

import { TextEncoder, TextDecoder } from 'util';
import { Response, Request, Headers, fetch } from 'whatwg-fetch';
import { EventEmitter } from 'events';

// Polyfill TextEncoder/TextDecoder for Node.js
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as any;

// Polyfill fetch APIs
if (!global.fetch) {
  global.fetch = fetch as any;
}
if (!global.Response) {
  global.Response = Response as any;
}
if (!global.Request) {
  global.Request = Request as any;
}
if (!global.Headers) {
  global.Headers = Headers as any;
}

// Polyfill BroadcastChannel for MSW
if (!global.BroadcastChannel) {
  class BroadcastChannelPolyfill extends EventEmitter {
    constructor(public name: string) {
      super();
    }

    postMessage(message: any) {
      this.emit('message', { data: message });
    }

    close() {
      this.removeAllListeners();
    }
  }

  global.BroadcastChannel = BroadcastChannelPolyfill as any;
}

// Polyfill ReadableStream if needed
try {
  if (!global.ReadableStream && typeof require !== 'undefined') {
    const { ReadableStream } = require('stream/web');
    global.ReadableStream = ReadableStream;
  }
} catch (e) {
  // Ignore if stream/web is not available
}

// Polyfill WritableStream if needed
try {
  if (!global.WritableStream && typeof require !== 'undefined') {
    const { WritableStream } = require('stream/web');
    global.WritableStream = WritableStream;
  }
} catch (e) {
  // Ignore if stream/web is not available
}

// Polyfill TransformStream if needed
try {
  if (!global.TransformStream && typeof require !== 'undefined') {
    const { TransformStream } = require('stream/web');
    global.TransformStream = TransformStream;
  }
} catch (e) {
  // Ignore if stream/web is not available
}
