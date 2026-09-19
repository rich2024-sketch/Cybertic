import assert from "node:assert/strict";
import { after, test } from "node:test";
import { mkdir, mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import vm from "node:vm";
import ts from "typescript";

// No microphone, provider credentials, or real network requests are used here.
const root = process.cwd();
await mkdir(path.join(root, ".sites-runtime"), { recursive: true });
const temp = await mkdtemp(path.join(root, ".sites-runtime", "live-tests-"));
for (const name of ["live-server", "live-protocol", "live-audio", "live-client", "ai-client"]) {
  const source = await readFile(path.join(root, "lib/studymate", name + ".ts"), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } });
  await writeFile(path.join(temp, name + ".js"), outputText.replace(/from "(\.\/[^".]+)"/g, 'from "$1.js"'));
}
const load = name => import(pathToFileURL(path.join(temp, name + ".js")).href);
const { issueLiveSession, liveTranslationEnabled } = await load("live-server");
const { LIVE_MODEL, appendLiveText, decodePcm16 } = await load("live-protocol");
const { LiveAudioPlayer } = await load("live-audio");
const { GeminiLiveTranslation } = await load("live-client");
const { generateStudy } = await load("ai-client");
after(() => rm(temp, { recursive: true, force: true }));
const tick = ms => new Promise(resolve => setTimeout(resolve, ms));

test("session endpoint gates access, fixes the model/language, and never returns the permanent key", async () => {
  const keys = ["STUDYMATE_ENABLE_LIVE_TRANSLATION", "GEMINI_LIVE_API_KEY", "STUDYMATE_APP_ORIGIN"];
  const old = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  const oldFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, init) => { requests.push({ url, ...init }); return Response.json({ name: "auth_tokens/test-session" }); };
  const request = (body = "{}", origin = "https://study.example") => new Request("https://study.example/api/live/session", { method: "POST", headers: { "Content-Type": "application/json", Origin: origin }, body });
  try {
    Object.assign(process.env, { STUDYMATE_ENABLE_LIVE_TRANSLATION: "false", GEMINI_LIVE_API_KEY: "private-test-key", STUDYMATE_APP_ORIGIN: "https://study.example" });
    assert.equal(liveTranslationEnabled(), false);
    assert.equal((await issueLiveSession(request())).status, 503);
    process.env.STUDYMATE_ENABLE_LIVE_TRANSLATION = "true";
    assert.equal((await issueLiveSession(request("{}", "https://foreign.example"))).status, 403);
    assert.equal((await issueLiveSession(request("{}", ""))).status, 403);
    assert.equal((await issueLiveSession(request('{"model":"other-model"}'))).status, 400);
    assert.equal((await issueLiveSession(request("x".repeat(200)))).status, 413);
    assert.equal(requests.length, 0);
    const response = await issueLiveSession(request());
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const result = await response.json();
    assert.equal(result.model, LIVE_MODEL);
    assert.equal(result.token, "auth_tokens/test-session");
    assert.ok(!JSON.stringify(result).includes("private-test-key"));
    const sent = JSON.parse(requests[0].body);
    assert.equal(requests[0].url, "https://generativelanguage.googleapis.com/v1beta/auth_tokens");
    assert.equal(requests[0].headers["x-goog-api-key"], "private-test-key");
    assert.equal(sent.uses, 1);
    assert.ok(new Date(sent.newSessionExpireTime) - Date.now() <= 60_000);
    assert.equal(sent.bidiGenerateContentSetup.model, "models/" + LIVE_MODEL);
    assert.deepEqual(sent.bidiGenerateContentSetup.generationConfig.translationConfig, { targetLanguageCode: "en", echoTargetLanguage: false });
    assert.deepEqual(sent.bidiGenerateContentSetup.inputAudioTranscription, {});
    assert.deepEqual(sent.bidiGenerateContentSetup.outputAudioTranscription, {});
    assert.equal(sent.fieldMask, undefined); // Complete setup is locked by the service.
    globalThis.fetch = async () => Response.json({ error: "private-test-key provider detail" }, { status: 429 });
    const rejected = await issueLiveSession(request());
    assert.equal(rejected.status, 429);
    assert.ok(!(await rejected.text()).includes("private-test-key"));
    globalThis.fetch = async () => { throw new Error("private-test-key network detail"); };
    const failed = await issueLiveSession(request());
    assert.equal(failed.status, 504);
    assert.ok(!(await failed.text()).includes("private-test-key"));
    for (let i = 0; i < 6; i++) await issueLiveSession(request());
    assert.equal((await issueLiveSession(request())).status, 429);
  } finally {
    globalThis.fetch = oldFetch;
    for (const [k, value] of Object.entries(old)) { if (value === undefined) delete process.env[k]; else process.env[k] = value; }
  }
});

test("streamed transcripts preserve independent ordering and repeated words", () => {
  let segment = { id: "one", seconds: 12, korean: "", english: "" };
  segment = appendLiveText(segment, { serverContent: { outputTranscription: { text: "Very " } } });
  segment = appendLiveText(segment, { serverContent: { inputTranscription: { text: "아주 " } } });
  segment = appendLiveText(segment, { serverContent: { outputTranscription: { text: "very important." }, inputTranscription: { text: "중요합니다." } } });
  assert.equal(segment.english, "Very very important.");
  assert.equal(segment.korean, "아주 중요합니다.");
  assert.equal(segment.seconds, 12);
});

test("audio worklet resamples common microphone rates, flushes tails, and stops when paused", async () => {
  const code = await readFile(path.join(root, "public/audio/pcm-capture.js"), "utf8");
  for (const rate of [16000, 44100, 48000]) {
    let Processor;
    const messages = [];
    vm.runInNewContext(code, { sampleRate: rate, AudioWorkletProcessor: class { port = { postMessage: message => messages.push(message) }; }, registerProcessor: (_name, value) => { Processor = value; } });
    const processor = new Processor();
    processor.port.onmessage({ data: { type: "enabled", value: true } });
    const count = Math.round(rate * 0.25);
    for (let i = 0; i < count; i += 128) processor.process([[new Float32Array(Math.min(128, count - i)).fill(0.5)]]);
    processor.port.onmessage({ data: { type: "flush" } });
    const packets = messages.filter(m => m.type === "audio");
    assert.equal(packets.length, 3);
    assert.equal(packets[0].buffer.byteLength, 3200);
    assert.ok(Math.abs(packets.reduce((n, m) => n + m.buffer.byteLength / 2, 0) - 4000) <= 1);
    assert.equal(new DataView(packets[0].buffer).getInt16(0, true), 16384);
    const previous = messages.length;
    processor.process([[new Float32Array(128).fill(1)]]);
    assert.equal(messages.length, previous);
    assert.equal(messages.at(-1).type, "flushed");
  }
  assert.deepEqual([...decodePcm16(btoa("\0\x80\xff\x7f"))], [-1, 32767 / 32768]);
});

class FakeNode {
  connect() {}
  disconnect() {}
}
class FakeAudioContext {
  static instances = [];
  currentTime = 10;
  state = "running";
  destination = {};
  sources = [];
  audioWorklet = { addModule: async () => {} };
  constructor() { FakeAudioContext.instances.push(this); }
  async resume() { this.state = "running"; }
  async close() { this.state = "closed"; }
  createMediaStreamSource() { return new FakeNode(); }
  createBuffer(_channels, count, rate) { const samples = new Float32Array(count); return { duration: count / rate, getChannelData: () => samples }; }
  createBufferSource() {
    const source = { connect() {}, disconnect() {}, stopped: false, start(time) { this.startTime = time; }, stop() { this.stopped = true; } };
    this.sources.push(source);
    return source;
  }
}

test("translated audio plays in order, drops stale playback, and does not queue while muted", () => {
  const context = new FakeAudioContext();
  let skips = 0;
  const player = new LiveAudioPlayer(context, () => skips++);
  const second = btoa("\0\0".repeat(24000));
  player.push(second, "audio/pcm;rate=24000");
  assert.equal(context.sources.length, 0);
  player.setEnabled(true);
  player.push(second, "audio/pcm;rate=24000");
  player.push(second, "audio/pcm;rate=24000");
  assert.ok(context.sources[1].startTime > context.sources[0].startTime);
  player.push(second, "audio/pcm;rate=24000");
  assert.equal(skips, 1);
  assert.equal(context.sources[0].stopped, true);
  assert.equal(context.sources[1].stopped, true);
  player.setEnabled(false);
  assert.equal(context.sources[2].stopped, true);
});

class FakeWorklet extends FakeNode {
  static instances = [];
  port = { onmessage: null, postMessage: data => {
    if (data.type === "flush") queueMicrotask(() => {
      this.port.onmessage?.({ data: { type: "audio", buffer: new ArrayBuffer(40) } });
      this.port.onmessage?.({ data: { type: "flushed" } });
    });
  } };
  constructor() { super(); FakeWorklet.instances.push(this); }
  audio() { this.port.onmessage?.({ data: { type: "audio", buffer: new ArrayBuffer(3200) } }); }
}
class FakeSocket {
  static OPEN = 1; static CLOSING = 2; static instances = []; static autoSetup = true;
  readyState = 1; bufferedAmount = 0; sent = [];
  constructor(url) { this.url = url; FakeSocket.instances.push(this); queueMicrotask(() => this.onopen?.()); }
  send(text) {
    const data = JSON.parse(text); this.sent.push(data);
    if (data.setup && FakeSocket.autoSetup) queueMicrotask(() => this.message({ setupComplete: {} }));
    if (data.realtimeInput?.audioStreamEnd) queueMicrotask(() => this.message({ serverContent: { inputTranscription: { text: " 마지막입니다." }, outputTranscription: { text: " The final words." }, turnComplete: true } }));
  }
  message(data) { this.onmessage?.({ data: JSON.stringify(data) }); }
  close(code = 1000) { this.readyState = 3; this.onclose?.({ code }); }
}

async function withBrowser(run) {
  const names = ["AudioContext", "AudioWorkletNode", "WebSocket", "fetch"];
  const old = Object.fromEntries(names.map(n => [n, globalThis[n]]));
  FakeSocket.instances = []; FakeWorklet.instances = []; FakeAudioContext.instances = []; FakeSocket.autoSetup = true;
  Object.assign(globalThis, { AudioContext: FakeAudioContext, AudioWorkletNode: FakeWorklet, WebSocket: FakeSocket, fetch: async () => Response.json({ token: "auth_tokens/fake", model: LIVE_MODEL }) });
  try { await run(); } finally { for (const [n, value] of Object.entries(old)) { if (value === undefined) delete globalThis[n]; else globalThis[n] = value; } }
}

test("continuous capture emits English before input ends and drains final text before saving", () => withBrowser(async () => {
  const segments = [], states = [];
  const client = new GeminiLiveTranslation({}, { seconds: () => 4, onSegment: s => segments.push(s), onState: s => states.push(s), onDraft() {}, onNotice() {} });
  try {
    FakeSocket.autoSetup = false;
    const starting = client.start();
    await tick(0);
    const socket = FakeSocket.instances[0];
    assert.ok(socket.url.includes("BidiGenerateContentConstrained?access_token="));
    assert.ok(!socket.url.includes("?key="));
    FakeWorklet.instances[0].audio();
    assert.equal(socket.sent.filter(s => s.realtimeInput?.audio).length, 0);
    socket.message({ setupComplete: {} });
    await starting;
    FakeWorklet.instances[0].audio();
    socket.message({ serverContent: { inputTranscription: { text: "세포" }, outputTranscription: { text: "Cells" } } });
    assert.equal(segments.at(-1).english, "Cells");
    assert.ok(!socket.sent.some(s => s.realtimeInput?.audioStreamEnd));
    FakeWorklet.instances[0].audio();
    await client.finish();
    assert.equal(segments.at(-1).korean, "세포 마지막입니다.");
    assert.equal(segments.at(-1).english, "Cells The final words.");
    assert.equal(socket.sent.at(-1).realtimeInput.audioStreamEnd, true);
    assert.equal(states.at(-1), "closed");
    assert.equal(FakeAudioContext.instances[0].state, "closed");
    const saved = segments.length;
    socket.message({ serverContent: { outputTranscription: { text: "Stale data" } } });
    assert.equal(segments.length, saved);
  } finally { client.dispose(); }
}));

test("connection recovery ignores stale messages and never stops the original recording's tracks", () => withBrowser(async () => {
  let stopped = 0;
  const segments = [], states = [];
  const client = new GeminiLiveTranslation({ getTracks: () => [{ stop: () => stopped++ }] }, { seconds: () => 7, onSegment: s => segments.push(s), onState: s => states.push(s), onDraft() {}, onNotice() {} });
  try {
    await client.start();
    const first = FakeSocket.instances[0];
    first.message({ serverContent: { inputTranscription: { text: "첫째" } } });
    first.close(1011);
    await tick(550);
    const second = FakeSocket.instances[1];
    assert.ok(second);
    first.message({ serverContent: { inputTranscription: { text: "ignored" } } });
    second.message({ serverContent: { inputTranscription: { text: "둘째" } } });
    assert.equal(segments.length, 2);
    assert.notEqual(segments[0].id, segments[1].id);
    assert.ok(states.includes("reconnecting"));
  } finally { client.dispose(); }
  assert.equal(stopped, 0);
}));

test("leaving during token setup aborts the request and cannot start a late microphone session", () => withBrowser(async () => {
  let aborted = false;
  globalThis.fetch = async (_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener("abort", () => { aborted = true; reject(new Error("cancelled")); }, { once: true });
  });
  const client = new GeminiLiveTranslation({}, { seconds: () => 0, onSegment() {}, onState() {}, onDraft() {}, onNotice() {} });
  const starting = client.start();
  const rejected = assert.rejects(starting, /cancelled/);
  await tick(0);
  client.dispose();
  await rejected;
  assert.equal(aborted, true);
  assert.equal(FakeSocket.instances.length, 0);
  assert.equal(FakeAudioContext.instances[0].state, "closed");
}));

test("expired hosted login produces a useful reconnect error instead of parsing an SSO page", () => withBrowser(async () => {
  globalThis.fetch = async () => new Response("<html>Sign in</html>", { headers: { "Content-Type": "text/html" } });
  const client = new GeminiLiveTranslation({}, { seconds: () => 0, onSegment() {}, onState() {}, onDraft() {}, onNotice() {} });
  try { await assert.rejects(client.start(), /Sign in to StudyMate/); }
  finally { client.dispose(); }
  assert.equal(FakeSocket.instances.length, 0);
}));

test("study generation uses source transcripts and preserves translation-only sections locally", async () => {
  const old = globalThis.fetch;
  let body;
  globalThis.fetch = async (_url, init) => { body = JSON.parse(init.body); return Response.json({}); };
  try {
    await generateStudy([{ id: "source", korean: "한국어", english: "Korean" }, { id: "translation-only", korean: "", english: "Preserved locally" }], { major: "Biology", subjects: [] }, 2);
    assert.deepEqual(body.segments, [{ id: "source", korean: "한국어" }]);
    assert.equal(body.year, 2);
  } finally { globalThis.fetch = old; }
});
