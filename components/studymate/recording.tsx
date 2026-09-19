"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Headphones, Mic, Pause, Play, Save, Square } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import type { Lecture, Segment, Student } from "@/lib/studymate/types";
import { formatDuration, newId } from "@/lib/studymate/types";
import { samples, sampleNotes } from "@/lib/studymate/demo";
import { saveAudio } from "@/lib/studymate/storage";
import { aiRequest, speakEnglish } from "@/lib/studymate/ai-client";
import { Brand, Picker } from "./common";
import { GeminiLiveTranslation, type LiveState } from "@/lib/studymate/live-client";

type Recognition = { lang: string; continuous: boolean; interimResults: boolean; onresult: ((e: { resultIndex: number; results: { length: number; [index: number]: { isFinal: boolean; [index: number]: { transcript: string } } } }) => void) | null; onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null; start: () => void; stop: () => void; abort: () => void };
type CaptureState = "ready" | "recording" | "paused" | "stopped";

export function Recording({ student, initialSubjectId, aiReady, onSave, onCancel }: { student: Student; initialSubjectId?: string; aiReady: boolean; onSave: (l: Lecture) => boolean; onCancel: () => void }) {
 const [mode, setMode] = useState("sample");
 const [sampleId, setSampleId] = useState(student.major.toLowerCase().includes("history") ? "history" : "biology");
 const sample = samples.find(s => s.id === sampleId)!;
 const [state, setState] = useState<CaptureState>("ready");
 const [segments, setSegments] = useState<Segment[]>([]);
 const [seconds, setSeconds] = useState(0);
 const [title, setTitle] = useState("");
 const [subjectId, setSubjectId] = useState(initialSubjectId || "unfiled");
 const [listen, setListen] = useState(false);
 const [busy, setBusy] = useState(false);
 const [leaving, setLeaving] = useState(false);
 const [hint, setHint] = useState("");
 const [blob, setBlob] = useState<Blob | null>(null);
 const [blobUrl, setBlobUrl] = useState("");
 const [interim, setInterim] = useState("");
 const [liveReady, setLiveReady] = useState<boolean | null>(null);
 const [useLive, setUseLive] = useState(true);
 const [usedLive, setUsedLive] = useState(false);
 const [liveState, setLiveState] = useState<LiveState>("closed");
 const live = useRef<GeminiLiveTranslation | null>(null);
 const liveChosen = useRef(false);
 const audioStopped = useRef<(() => void) | null>(null);
 const sourcePanel = useRef<HTMLDivElement>(null);
 const targetPanel = useRef<HTMLDivElement>(null);
 const followSource = useRef(true);
 const followTarget = useRef(true);
 const recorder = useRef<MediaRecorder | null>(null);
 const stream = useRef<MediaStream | null>(null);
 const recognition = useRef<Recognition | null>(null);
 const active = useRef(false);
 const mounted = useRef(true);
 const listening = useRef(false);
 const chunks = useRef<Blob[]>([]);
 const elapsed = useRef(0);
 const started = useRef(0);
 const sampleIndex = useRef(0);
 const translationQueue = useRef(Promise.resolve());
 const lectureId = useRef("");
 const allSegments = useRef<Segment[]>([]);
 function putSegments(next: Segment[]) { allSegments.current = next; setSegments(next); }
 function elapsedSeconds() { return Math.floor((elapsed.current + (active.current ? performance.now() - started.current : 0)) / 1000); }
 useEffect(() => { mounted.current = true; lectureId.current = newId(); return () => { mounted.current = false; active.current = false; live.current?.dispose(); recognition.current?.abort(); if (recorder.current?.state !== "inactive") { try { recorder.current?.stop(); } catch {} } stream.current?.getTracks().forEach(t => t.stop()); if ("speechSynthesis" in window) speechSynthesis.cancel(); }; }, []);
 useEffect(() => { if (state === "ready") return; const protect = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; }; window.addEventListener("beforeunload", protect); return () => window.removeEventListener("beforeunload", protect); }, [state]);
 useEffect(() => { if (!blob) return; const url = URL.createObjectURL(blob); setBlobUrl(url); return () => URL.revokeObjectURL(url); }, [blob]);
 useEffect(() => {
  if (state !== "recording") return;
  const timer = setInterval(() => {
   if (mode === "sample") {
    const next = sample.segments[sampleIndex.current];
    if (next) { putSegments([...allSegments.current, { ...next, id: newId() }]); sampleIndex.current += 1; setSeconds(next.seconds); if (listening.current) speakEnglish(next.english); }
    else { active.current = false; setState("stopped"); setSeconds((sample.segments.at(-1)?.seconds ?? 0) + 20); }
   } else setSeconds(elapsedSeconds());
  }, mode === "sample" ? 2400 : 500);
  return () => clearInterval(timer);
 }, [state, mode, sample]);
 useEffect(() => {
  let cancelled = false;
  fetch("/api/live/status", { cache: "no-store", signal: AbortSignal.timeout(7000) })
   .then(r => r.ok ? r.json() : null)
   .then(data => { if (!cancelled) setLiveReady(!!data && typeof data === "object" && "enabled" in data && data.enabled === true); })
   .catch(() => { if (!cancelled) setLiveReady(false); });
  return () => { cancelled = true; };
 }, []);
 useEffect(() => {
  if (followSource.current && sourcePanel.current) sourcePanel.current.scrollTop = sourcePanel.current.scrollHeight;
  if (followTarget.current && targetPanel.current) targetPanel.current.scrollTop = targetPanel.current.scrollHeight;
 }, [segments, interim]);
 async function startLive() {
  live.current?.dispose();
  const connection = new GeminiLiveTranslation(stream.current!, {
   seconds: elapsedSeconds,
   onState: value => { if (mounted.current && live.current === connection) setLiveState(value); },
   onDraft: value => { if (mounted.current && live.current === connection) setInterim(value); },
   onNotice: value => { if (mounted.current && live.current === connection) setHint(value); },
   onSegment: value => {
    if (!mounted.current || live.current !== connection) return;
    const exists = allSegments.current.some(s => s.id === value.id);
    putSegments(exists ? allSegments.current.map(s => s.id === value.id ? value : s) : [...allSegments.current, value]);
   },
  });
  live.current = connection;
  connection.setListening(listening.current);
  try { await connection.start(); }
  catch (e) {
   connection.dispose();
   if (mounted.current) { setLiveState("offline"); setHint((e instanceof Error ? e.message : "Live translation could not start.") + " Your original audio is still recording."); }
  }
 }
 async function reconnectLive() { setBusy(true); setHint(""); try { await startLive(); } finally { if (mounted.current) setBusy(false); } }
 function appendTranscript(korean: string) {
  if (!mounted.current || !korean.trim()) return;
  const entry: Segment = { id: newId(), seconds: elapsedSeconds(), korean: korean.trim(), english: "" };
  putSegments([...allSegments.current, entry]);
  if (aiReady) translationQueue.current = translationQueue.current.then(async () => {
   try { const result = await aiRequest<{ english: string }>("/api/translate", { korean: entry.korean, major: student.major, subjectNames: student.subjects.map(s => s.name) }); if (mounted.current) { putSegments(allSegments.current.map(s => s.id === entry.id ? { ...s, english: result.english } : s)); if (listening.current) speakEnglish(result.english); } }
   catch { if (mounted.current) setHint("Live translation paused. Your Korean transcript is kept; you can translate it again after saving."); }
  });
 }
 async function start() {
  setBusy(true); setHint("");
  if (mode === "sample") {
   setTitle(sample.title); const matched = student.subjects.find(s => s.name.toLowerCase() === sample.subject.toLowerCase()); setSubjectId(initialSubjectId || matched?.id || "unfiled"); active.current = true; setState("recording"); setBusy(false); return;
  }
  try {
   if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw new Error("Recording needs a supported browser on HTTPS or localhost.");
   stream.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
   if (!mounted.current) { stream.current.getTracks().forEach(t => t.stop()); return; }
   const mimeType = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find(t => MediaRecorder.isTypeSupported(t));
   recorder.current = new MediaRecorder(stream.current, mimeType ? { mimeType } : undefined);
   chunks.current = [];
   recorder.current.ondataavailable = event => { if (event.data.size) chunks.current.push(event.data); };
   recorder.current.onstop = () => { const audio = new Blob(chunks.current, { type: recorder.current?.mimeType || "audio/webm" }); if (mounted.current) setBlob(audio); stream.current?.getTracks().forEach(t => t.stop()); audioStopped.current?.(); audioStopped.current = null; };
   recorder.current.onerror = () => { if (mounted.current) { setHint("The recorder stopped unexpectedly. Save or download any audio that was captured."); void stop(); } };
   recorder.current.start(1000); active.current = true; started.current = performance.now(); setState("recording"); setTitle("Lecture · " + new Date().toLocaleDateString("en-GB"));
   liveChosen.current = liveReady === true && useLive;
   setUsedLive(liveChosen.current);
   if (liveChosen.current) { await startLive(); return; }
   const Speech = (window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }).SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: new () => Recognition }).webkitSpeechRecognition;
   if (Speech) {
    const r = new Speech(); recognition.current = r; r.lang = "ko-KR"; r.continuous = true; r.interimResults = true;
    r.onresult = event => { let draft = ""; for (let i = event.resultIndex; i < event.results.length; i++) { const result = event.results[i]; if (result.isFinal) appendTranscript(result[0].transcript); else draft += result[0].transcript; } if (mounted.current) setInterim(draft); };
    r.onerror = () => { if (mounted.current) setHint("Browser transcription is unavailable. Audio recording continues; paste a transcript after saving."); r.onend = null; };
    r.onend = () => { if (active.current && mounted.current) { try { r.start(); } catch {} } };
    try { r.start(); } catch { setHint("Browser transcription could not start. Audio recording continues."); }
   } else setHint("This browser records audio but does not provide live transcription. Paste a transcript after saving.");
  } catch (e) { active.current = false; stream.current?.getTracks().forEach(t => t.stop()); setHint(e instanceof DOMException && e.name === "NotAllowedError" ? "Microphone access was denied. Allow it in browser settings, or try a sample lecture." : e instanceof Error ? e.message : "The microphone could not start."); }
  finally { setBusy(false); }
 }
 async function pause() {
  if (busy) return;
  setBusy(true);
  if (mode !== "sample") {
   if (active.current) elapsed.current += performance.now() - started.current;
   active.current = false; setSeconds(Math.floor(elapsed.current / 1000));
   if (recorder.current?.state === "recording") recorder.current.pause();
   recognition.current?.stop();
  } else active.current = false;
  setState("paused");
  if ("speechSynthesis" in window) speechSynthesis.cancel();
  try { if (liveChosen.current) await live.current?.pause(); }
  finally { if (mounted.current) setBusy(false); }
 }
 async function resume() {
  if (busy) return;
  setBusy(true);
  if (mode !== "sample") {
   if (recorder.current?.state === "paused") recorder.current.resume();
   started.current = performance.now();
   if (!liveChosen.current) { try { recognition.current?.start(); } catch {} }
  }
  active.current = true; setState("recording");
  try { if (liveChosen.current) await startLive(); }
  finally { if (mounted.current) setBusy(false); }
 }
 async function stop() {
  if (mode === "sample") { active.current = false; setState("stopped"); if ("speechSynthesis" in window) speechSynthesis.cancel(); return; }
  setBusy(true);
  if (active.current) elapsed.current += performance.now() - started.current;
  active.current = false; setSeconds(Math.floor(elapsed.current / 1000));
  recognition.current?.stop();
  if ("speechSynthesis" in window) speechSynthesis.cancel();
  const finishTranslation = liveChosen.current ? live.current?.finish() : Promise.resolve();
  const finishRecording = new Promise<void>(resolve => {
   if (!recorder.current || recorder.current.state === "inactive") { resolve(); return; }
   const timer = setTimeout(() => { audioStopped.current = null; resolve(); }, 3000);
   audioStopped.current = () => { clearTimeout(timer); resolve(); };
   recorder.current.stop();
  });
  try { await Promise.all([finishTranslation, finishRecording]); }
  finally { if (mounted.current) { setInterim(""); setState("stopped"); setBusy(false); } }
 }
 async function save() {
  setBusy(true);
  try {
   if (mode === "microphone" && !blob?.size) throw new Error("No audio was captured. Start a new recording.");
   if (blob) await saveAudio(lectureId.current, blob);
   const completeSample = mode === "sample" && sampleIndex.current >= sample.segments.length;
   onSave({ id: lectureId.current, studentId: student.id, subjectId: subjectId === "unfiled" ? null : subjectId, title: title.trim() || "Untitled lecture", createdAt: new Date().toISOString(), duration: seconds, mode: mode === "sample" ? "sample" : "recording", sampleId: mode === "sample" ? sample.id : undefined, segments: allSegments.current, notes: completeSample ? sampleNotes(sample, student.year) : null, notesYear: student.year, hasAudio: !!blob, quizAnswers: {} });
  } catch (e) { toast.error(e instanceof Error ? e.message : "Could not save this lecture."); } finally { setBusy(false); }
 }
 return <main className="recording-page"><header className="recording-header"><Brand /><Button variant="ghost" onClick={() => { if (state === "ready") onCancel(); else setLeaving(true); }}><ArrowLeft size={17} />Back to workspace</Button></header><div className="recording-workspace"><div className="page-heading"><div><p className="eyebrow">CAPTURE THE CLASS</p><h1>Listen. Understand. Keep it.</h1><p>Korean lecture, English understanding.</p></div><span className="tag">{student.major} · Year {student.year}</span></div>{state === "ready" ? <section className="panel record-setup"><h2>Start a lecture</h2><Tabs value={mode} onValueChange={setMode}><TabsList><TabsTrigger value="sample">Sample lecture</TabsTrigger><TabsTrigger value="microphone">Microphone</TabsTrigger></TabsList><TabsContent value="sample"><p className="muted">Explore the complete flow with a prepared transcript and translation. Sample playback is accelerated; it does not use your microphone or paid AI.</p><Picker value={sampleId} onChange={setSampleId} label="Sample lecture" options={samples.map(s => ({ value: s.id, label: s.subject + " — " + s.title }))} /></TabsContent><TabsContent value="microphone"><p className="muted">Keep the original class recording on this device.</p>{liveReady && <div className="listen-bar"><Mic size={20} /><div><label htmlFor="live-mode">Live Korean → English</label><p>Stream audio to Google for continuous captions and spoken translation.</p></div><Switch id="live-mode" checked={useLive} onCheckedChange={setUseLive} /></div>}<p className="notice">{liveReady === null ? "Checking live translation…" : liveReady && useLive ? "Live translation is ready. Use earphones and turn on Listen in English after starting. Google’s free tier may use submitted audio to improve its products." : "Browser transcription mode waits for speech pauses. " + (aiReady ? "Recognised text is sent to the summary service for translation." : "AI translation is not connected; your original recording can still be saved.")}</p></TabsContent></Tabs><Button onClick={start} disabled={busy || mode === "microphone" && liveReady === null}>{mode === "sample" ? <Play size={18} /> : <Mic size={18} />}{busy ? "Opening microphone…" : mode === "sample" ? "Play sample lecture" : "Start Recording"}</Button></section> : <><div className="capture-toolbar"><div className="capture-status"><span className={"capture-dot " + state} /><strong>{state === "recording" ? mode === "sample" ? "Sample playing" : "Recording" : state === "paused" ? "Paused" : "Ready to save"}</strong><span className="timer">{formatDuration(seconds)}</span></div><div className="capture-actions">{state === "recording" && <Button variant="outline" onClick={pause} disabled={busy}><Pause size={16} />Pause</Button>}{state === "paused" && <Button variant="outline" onClick={resume} disabled={busy}><Play size={16} />Resume</Button>}{state !== "stopped" && <Button variant="outline" onClick={stop} disabled={busy}><Square size={15} />End lecture</Button>}</div></div>{usedLive && <div className="notice" role="status"><span>{liveState === "live" ? "Live translation connected" : liveState === "connecting" ? "Connecting live translation…" : liveState === "reconnecting" ? "Reconnecting — original audio still recording" : liveState === "finishing" ? "Finishing the final captions…" : liveState === "paused" ? "Live translation paused" : liveState === "offline" ? "Translation offline — original audio still recording" : "Live translation finished"}</span>{liveState === "offline" && state === "recording" && <Button variant="outline" onClick={reconnectLive} disabled={busy}>Reconnect translation</Button>}</div>}<div className="transcript-columns"><section className="transcript-panel"><header><span className="language-label">KO</span><h2>Korean transcript</h2><span>{mode === "sample" ? "Prepared sample" : usedLive ? "Live source captions" : "Browser speech service"}</span></header><div className="transcript-stream" aria-live="polite" ref={sourcePanel} onScroll={e => { const el = e.currentTarget; followSource.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100; }}>{!segments.length && <p className="muted">{mode === "sample" ? "The sample transcript will appear here." : "Speak in Korean. Recognised speech will appear here when supported."}</p>}{segments.filter(s => s.korean).map(s => <div className="transcript-entry" key={s.id}><time>{formatDuration(s.seconds)}</time><p lang="ko" style={{ whiteSpace: "pre-wrap" }}>{s.korean}</p></div>)}{interim && <p className="interim" lang="ko">{interim}</p>}</div></section><section className="transcript-panel translation-panel"><header><span className="language-label">EN</span><h2>English translation</h2><span>{mode === "sample" ? "Prepared sample" : usedLive ? "Live English captions" : aiReady ? "AI translation" : "Not connected"}</span></header><div className="transcript-stream" ref={targetPanel} onScroll={e => { const el = e.currentTarget; followTarget.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100; }}>{!segments.length && <p className="muted">English translations will appear alongside the Korean transcript.</p>}{segments.map(s => <div className="transcript-entry" key={s.id}><time>{formatDuration(s.seconds)}</time><p style={{ whiteSpace: "pre-wrap" }}>{s.english || (usedLive ? state === "stopped" ? "No English caption received for this section." : "Listening for English captions…" : aiReady ? "Waiting for translation…" : "Connect live AI to translate this segment.")}</p></div>)}</div></section></div><div className="listen-bar"><Headphones size={21} /><div><label htmlFor="listen-toggle">Listen in English</label><p>Use earphones. Spoken translation follows the original speech.</p></div><Switch id="listen-toggle" checked={listen} disabled={mode !== "sample" && !aiReady && !usedLive} onCheckedChange={value => { setListen(value); listening.current = value; if (usedLive) { live.current?.setListening(value); return; } if (!value && "speechSynthesis" in window) speechSynthesis.cancel(); if (value && !("speechSynthesis" in window)) { setListen(false); listening.current = false; toast.error("Spoken playback is not supported in this browser."); } }} /></div>{state === "stopped" && <section className="panel save-panel"><div className="panel-title"><Check size={21} /><h2>Keep this lecture organised</h2></div>{mode === "sample" && <p className="field-help">Sample subject matching uses the prepared lesson title. Confirm the class before saving.</p>}<div className="field-grid"><label>Lecture title<Input value={title} maxLength={150} onChange={e => setTitle(e.target.value)} /></label><label>Save under subject<Picker label="Save under subject" value={subjectId} onChange={setSubjectId} options={[{ value: "unfiled", label: "Unfiled — choose later" }, ...student.subjects.map(s => ({ value: s.id, label: s.name }))]} /></label></div>{blobUrl && <div className="audio-preview"><audio controls src={blobUrl} /><a href={blobUrl} download={"studymate-recording." + (blob?.type.includes("mp4") ? "m4a" : "webm")}>Download audio</a></div>}<Button onClick={save} disabled={busy || !segments.length && !blob}><Save size={17} />{busy ? "Saving…" : "Save lecture"}</Button></section>}</>}{hint && <p className="notice warning" role="status">{hint}</p>}</div><AlertDialog open={leaving} onOpenChange={setLeaving}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Leave this lecture?</AlertDialogTitle><AlertDialogDescription>Your current recording has not been saved. Stay here to end and save it first.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Keep working</AlertDialogCancel><AlertDialogAction onClick={onCancel}>Discard and leave</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></main>;
}
