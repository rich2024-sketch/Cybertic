/* Microphone -> 100 ms, mono PCM16 chunks at 16 kHz. Never plays the microphone. */
class StudyMatePcmCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.enabled = false;
    this.ratio = sampleRate / 16000;
    this.remaining = this.ratio;
    this.total = 0;
    this.samples = [];
    this.port.onmessage = ({ data }) => {
      if (data.type === "enabled") {
        this.enabled = data.value;
        if (!data.value) { this.samples = []; this.remaining = this.ratio; this.total = 0; }
      }
      if (data.type === "flush") {
        this.enabled = false;
        this.send();
        this.remaining = this.ratio;
        this.total = 0;
        this.port.postMessage({ type: "flushed" });
      }
    };
  }
  send() {
    if (!this.samples.length) return;
    const buffer = new ArrayBuffer(this.samples.length * 2);
    const view = new DataView(buffer);
    this.samples.forEach((sample, i) => {
      const value = Math.max(-1, Math.min(1, sample));
      view.setInt16(i * 2, Math.round(value * (value < 0 ? 32768 : 32767)), true);
    });
    this.samples = [];
    this.port.postMessage({ type: "audio", buffer }, [buffer]);
  }
  process(inputs) {
    if (!this.enabled) return true;
    const channels = inputs[0];
    if (!channels?.[0]) return true;
    for (let i = 0; i < channels[0].length; i++) {
      let sample = 0;
      for (const channel of channels) sample += channel[i] / channels.length;
      let weight = 1;
      while (weight > 1e-8) {
        const take = Math.min(weight, this.remaining);
        this.total += sample * take;
        this.remaining -= take;
        weight -= take;
        if (this.remaining < 1e-8) {
          this.samples.push(this.total / this.ratio);
          this.remaining = this.ratio;
          this.total = 0;
          if (this.samples.length === 1600) this.send();
        }
      }
    }
    return true;
  }
}
registerProcessor("studymate-pcm-capture", StudyMatePcmCapture);
