import { decodePcm16 } from "./live-protocol";

export class LiveAudioPlayer {
  private nextStart = 0;
  private sources = new Set<AudioBufferSourceNode>();
  private enabled = false;
  constructor(private context: AudioContext, private onSkip: () => void) {}

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) this.clear();
  }

  push(data: string, mimeType: string) {
    if (!this.enabled) return;
    if (!/^audio\/pcm(?:;|$)/.test(mimeType)) return;
    const rate = Number(/rate=(\d+)/.exec(mimeType)?.[1] || 24000);
    if (rate < 8000 || rate > 48000) return;
    let samples = decodePcm16(data);
    const now = this.context.currentTime;
    const maxSamples = rate * 3;
    if (this.nextStart - now + samples.length / rate > 3) {
      this.clear();
      if (samples.length > maxSamples) samples = samples.slice(-maxSamples);
      this.onSkip();
    }
    const buffer = this.context.createBuffer(1, samples.length, rate);
    buffer.getChannelData(0).set(samples);
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.context.destination);
    source.onended = () => { source.disconnect(); this.sources.delete(source); };
    this.sources.add(source);
    const start = Math.max(this.context.currentTime + 0.015, this.nextStart);
    source.start(start);
    this.nextStart = start + buffer.duration;
  }

  clear() {
    for (const source of this.sources) { source.onended = null; try { source.stop(); } catch {} source.disconnect(); }
    this.sources.clear();
    this.nextStart = this.context.currentTime;
  }
}
