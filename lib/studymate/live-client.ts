import type { Segment } from "./types";
import { appendLiveText, LIVE_MODEL, LIVE_SOCKET, pcmToBase64, translationSetup, type LiveMessage } from "./live-protocol";
import { LiveAudioPlayer } from "./live-audio";

export type LiveState = "connecting" | "live" | "reconnecting" | "paused" | "finishing" | "offline" | "closed";
type Callbacks = {
  onState: (state: LiveState) => void;
  onSegment: (segment: Segment) => void;
  onDraft: (text: string) => void;
  onNotice: (text: string) => void;
  seconds: () => number;
};

export class GeminiLiveTranslation {
  private context: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private capture: AudioWorkletNode | null = null;
  private player: LiveAudioPlayer | null = null;
  private socket: WebSocket | null = null;
  private request: AbortController | null = null;
  private wanted = false;
  private disposed = false;
  private ready = false;
  private listening = false;
  private sentAudio = false;
  private segment: Segment | null = null;
  private rotation: ReturnType<typeof setTimeout> | undefined;
  private recovering: Promise<void> | null = null;
  private failures = 0;
  private connectedAt = 0;
  private flushDone: (() => void) | null = null;
  private cancelConnect: (() => void) | null = null;
  private drain: { complete: boolean; settle: ReturnType<typeof setTimeout> | undefined; finish: (ok: boolean) => void } | null = null;

  constructor(private stream: MediaStream, private callbacks: Callbacks) {}

  async start() {
    this.wanted = true;
    this.callbacks.onState("connecting");
    this.context = new AudioContext({ latencyHint: "interactive" });
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Tap Reconnect translation to enable browser audio.")), 3000);
      this.context!.resume().then(() => { clearTimeout(timeout); resolve(); }, error => { clearTimeout(timeout); reject(error); });
    });
    if (this.disposed) return;
    await this.context.audioWorklet.addModule("/audio/pcm-capture.js");
    if (this.disposed) return;
    this.player = new LiveAudioPlayer(this.context, () => this.callbacks.onNotice("English audio skipped ahead to stay live. All received text is still kept."));
    this.capture = new AudioWorkletNode(this.context, "studymate-pcm-capture");
    this.source = this.context.createMediaStreamSource(this.stream);
    this.source.connect(this.capture);
    // The worklet outputs silence. Keeping it connected makes processing reliable.
    this.capture.connect(this.context.destination);
    this.capture.port.onmessage = ({ data }: MessageEvent<{ type: string; buffer?: ArrayBuffer }>) => {
      if (data.type === "flushed") { this.flushDone?.(); return; }
      if (data.type !== "audio" || !data.buffer || !this.ready || this.disposed || this.socket?.readyState !== WebSocket.OPEN) return;
      // Never accumulate minutes of microphone audio in a network queue.
      if (this.socket.bufferedAmount > 64_000) { void this.recover(); return; }
      this.socket.send(JSON.stringify({ realtimeInput: { audio: { data: pcmToBase64(data.buffer), mimeType: "audio/pcm;rate=16000" } } }));
      this.sentAudio = true;
    };
    await this.connect();
  }

  setListening(value: boolean) {
    this.listening = value;
    this.player?.setEnabled(value && this.wanted && this.ready);
    if (value && this.context?.state === "suspended") {
      void this.context.resume().catch(() => this.callbacks.onNotice("Tap Listen in English again to enable playback."));
    }
  }

  private async connect() {
    if (!this.wanted || this.disposed) return;
    this.request = new AbortController();
    const timeout = setTimeout(() => this.request?.abort(), 15_000);
    let token: string;
    try {
      const response = await fetch("/api/live/session", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: "{}", credentials: "same-origin", cache: "no-store", signal: this.request.signal,
      });
      if (!response.headers.get("content-type")?.includes("application/json")) throw new Error("Your app session may have expired. Sign in to StudyMate again.");
      const data = await response.json() as { token?: string; model?: string; error?: string };
      if (!response.ok) throw new Error(data.error || "Live translation could not connect.");
      if (data.model !== LIVE_MODEL || !data.token?.startsWith("auth_tokens/")) throw new Error("The live session response was invalid.");
      token = data.token;
    } finally { clearTimeout(timeout); this.request = null; }
    if (!this.wanted || this.disposed) return;
    const socket = new WebSocket(LIVE_SOCKET + "?access_token=" + encodeURIComponent(token));
    socket.binaryType = "arraybuffer";
    this.socket = socket;
    this.sentAudio = false;
    this.segment = { id: crypto.randomUUID(), seconds: this.callbacks.seconds(), korean: "", english: "" };
    await new Promise<void>((resolve, reject) => {
      let connected = false;
      const deadline = setTimeout(() => { reject(new Error("Live translation connection timed out.")); socket.close(); }, 12_000);
      this.cancelConnect = () => { clearTimeout(deadline); reject(new Error("Connection cancelled.")); };
      socket.onopen = () => {
        if (this.disposed || !this.wanted || socket !== this.socket) { socket.close(); return; }
        socket.send(JSON.stringify({ setup: translationSetup() }));
      };
      socket.onmessage = event => {
        if (this.disposed || socket !== this.socket) return;
        try {
          const text = typeof event.data === "string" ? event.data : new TextDecoder().decode(event.data);
          if (text.length > 2_000_000) throw new Error("Oversized live message.");
          const message = JSON.parse(text) as LiveMessage;
          if (message.error) { socket.close(1008, "Provider rejected session"); return; }
          if (message.setupComplete !== undefined && !connected) {
            connected = true; this.ready = true; this.connectedAt = Date.now();
            clearTimeout(deadline); this.cancelConnect = null;
            this.capture?.port.postMessage({ type: "enabled", value: this.wanted });
            this.player?.setEnabled(this.listening && this.wanted);
            this.callbacks.onState("live");
            // Start a fresh constrained session before the connection time limit.
            this.rotation = setTimeout(() => { void this.recover(); }, 9 * 60_000);
            resolve();
          }
          if (connected) this.receive(message);
          if (message.goAway && this.wanted) void this.recover();
        } catch {
          this.callbacks.onNotice("An unreadable live response interrupted translation. The original audio is still recording.");
          socket.close(1002, "Invalid live response");
        }
      };
      socket.onerror = () => { if (!connected) { clearTimeout(deadline); reject(new Error("Could not reach live translation. Check your connection.")); socket.close(); } };
      socket.onclose = event => {
        clearTimeout(deadline);
        if (!connected) reject(new Error("Live translation could not start. Check Google model access and quota."));
        if (socket !== this.socket) return;
        clearTimeout(this.rotation);
        this.ready = false;
        this.capture?.port.postMessage({ type: "enabled", value: false });
        this.player?.clear();
        this.drain?.finish(false);
        if (connected && this.wanted && !this.disposed) {
          if ([1002, 1003, 1007, 1008].includes(event.code)) {
            this.callbacks.onState("offline");
            this.callbacks.onNotice("Google stopped live translation. Check access or quota, then reconnect. Audio recording continues.");
          } else void this.recover();
        }
      };
    });
  }

  private receive(message: LiveMessage) {
    const content = message.serverContent;
    if (!content) return;
    if (this.segment && (content.inputTranscription?.text || content.outputTranscription?.text)) {
      this.segment = appendLiveText(this.segment, message);
      this.callbacks.onSegment({ ...this.segment });
    }
    if (content.interimInputTranscription?.text !== undefined) this.callbacks.onDraft(content.interimInputTranscription.text);
    else if (content.inputTranscription?.text) this.callbacks.onDraft("");
    if (content.interrupted) this.player?.clear();
    for (const part of content.modelTurn?.parts ?? []) {
      if (part.inlineData?.data) this.player?.push(part.inlineData.data, part.inlineData.mimeType ?? "audio/pcm;rate=24000");
    }
    if (this.drain) {
      if (content.generationComplete || content.turnComplete) this.drain.complete = true;
      if (this.drain.complete) {
        clearTimeout(this.drain.settle);
        this.drain.settle = setTimeout(() => this.drain?.finish(true), 750);
      }
    }
  }

  private recover(): Promise<void> {
    if (this.recovering) return this.recovering;
    if (!this.wanted || this.disposed) return Promise.resolve();
    if (Date.now() - this.connectedAt > 60_000) this.failures = 0;
    this.disconnect();
    this.callbacks.onState("reconnecting");
    this.callbacks.onNotice("Reconnecting translation. The original recording keeps any speech missed during this gap.");
    this.recovering = (async () => {
      while (this.wanted && !this.disposed && this.failures < 3) {
        this.failures++;
        await new Promise(resolve => setTimeout(resolve, 500 * this.failures));
        if (!this.wanted || this.disposed) return;
        try { await this.connect(); return; } catch { this.disconnect(); }
      }
      if (this.wanted && !this.disposed) {
        this.callbacks.onState("offline");
        this.callbacks.onNotice("Live translation is offline. Audio recording continues. Use Reconnect translation to try again.");
      }
    })().finally(() => { this.recovering = null; });
    return this.recovering;
  }

  private async suspend() {
    this.wanted = false;
    clearTimeout(this.rotation);
    this.request?.abort();
    this.player?.setEnabled(false);
    if (this.capture && this.ready) {
      await new Promise<void>(resolve => {
        const timeout = setTimeout(resolve, 250);
        this.flushDone = () => { clearTimeout(timeout); this.flushDone = null; resolve(); };
        this.capture!.port.postMessage({ type: "flush" });
      });
    }
    if (this.socket?.readyState === WebSocket.OPEN && this.ready && this.sentAudio) {
      const drained = await new Promise<boolean>(resolve => {
        const timeout = setTimeout(() => this.drain?.finish(false), 8000);
        this.drain = { complete: false, settle: undefined, finish: ok => {
          clearTimeout(timeout); clearTimeout(this.drain?.settle); this.drain = null; resolve(ok);
        } };
        this.socket!.send(JSON.stringify({ realtimeInput: { audioStreamEnd: true } }));
      });
      if (!drained && !this.disposed) this.callbacks.onNotice("Translation finishing timed out. The original audio is complete, but the last caption may be incomplete.");
    }
    this.disconnect();
    this.callbacks.onDraft("");
  }

  async pause() { await this.suspend(); if (!this.disposed) this.callbacks.onState("paused"); }
  async resume() {
    if (this.disposed) return;
    this.wanted = true; this.failures = 0;
    this.callbacks.onState("connecting");
    await this.context?.resume();
    await this.connect();
  }
  async finish() { this.callbacks.onState("finishing"); await this.suspend(); this.dispose(); this.callbacks.onState("closed"); }

  private disconnect() {
    clearTimeout(this.rotation);
    this.ready = false;
    this.capture?.port.postMessage({ type: "enabled", value: false });
    this.player?.clear();
    const socket = this.socket;
    this.socket = null;
    this.cancelConnect?.(); this.cancelConnect = null;
    if (socket && socket.readyState < WebSocket.CLOSING) socket.close();
  }

  dispose() {
    this.disposed = true; this.wanted = false;
    this.request?.abort();
    this.drain?.finish(false);
    this.flushDone?.();
    this.disconnect();
    if (this.capture) this.capture.port.onmessage = null;
    this.source?.disconnect(); this.capture?.disconnect();
    if (this.context && this.context.state !== "closed") void this.context.close().catch(() => {});
    // MediaRecorder owns the microphone tracks; never stop them here.
  }
}
