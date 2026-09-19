import type { Segment } from "./types";

export const LIVE_MODEL = "gemini-3.5-live-translate-preview";
export const LIVE_SOCKET = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained";

// REST/WebSocket wire format (not the Google SDK's liveConnectConstraints shape).
// https://ai.google.dev/api/live#BidiGenerateContentSetup
export function translationSetup() {
  return {
    model: "models/" + LIVE_MODEL,
    generationConfig: {
      responseModalities: ["AUDIO"],
      translationConfig: { targetLanguageCode: "en", echoTargetLanguage: false },
    },
    inputAudioTranscription: {},
    outputAudioTranscription: {},
  };
}

export type LiveMessage = {
  setupComplete?: object;
  error?: { code?: number };
  goAway?: { timeLeft?: string };
  serverContent?: {
    inputTranscription?: { text?: string };
    interimInputTranscription?: { text?: string };
    outputTranscription?: { text?: string };
    modelTurn?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] };
    interrupted?: boolean;
    generationComplete?: boolean;
    turnComplete?: boolean;
  };
};

// Source and translation arrive independently. Group by connection, never pretend
// that individual source/target deltas are aligned sentence pairs.
export function appendLiveText(segment: Segment, message: LiveMessage): Segment {
  const content = message.serverContent;
  return {
    ...segment,
    korean: segment.korean + (content?.inputTranscription?.text ?? ""),
    english: segment.english + (content?.outputTranscription?.text ?? ""),
  };
}

export function pcmToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export function decodePcm16(data: string): Float32Array {
  const binary = atob(data);
  if (!binary.length || binary.length % 2) throw new Error("Invalid PCM audio.");
  const samples = new Float32Array(binary.length / 2);
  for (let i = 0; i < samples.length; i++) {
    const value = binary.charCodeAt(i * 2) | binary.charCodeAt(i * 2 + 1) << 8;
    samples[i] = (value >= 32768 ? value - 65536 : value) / 32768;
  }
  return samples;
}
