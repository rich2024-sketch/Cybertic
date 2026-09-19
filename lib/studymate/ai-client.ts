import type { AssignmentKind, Segment, Student, StudyNotes } from "./types";
export async function aiRequest<T>(path: string, body: unknown): Promise<T> {
 const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(45000) });
 const result = await response.json() as T & { error?: string };
 if (!response.ok) throw new Error(result.error || "The AI service is unavailable. Your recording is still saved.");
 return result as T;
}
export type StudyResult = { title: string; subjectId: string | null; notes: StudyNotes; translations: { id: string; english: string }[] };
export type AssignmentResult = {
 items: {
  kind: AssignmentKind;
  title: string;
  instructions: string;
  deadlineLabel: string;
  deadlineDate: string | null;
  deadlineTimeText: string;
  deadlineAt: string | null;
  excerpt: string;
  needsConfirmation: boolean;
 }[];
};
export function generateStudy(segments: Segment[], student: Student, year: number) {
 return aiRequest<StudyResult>("/api/study", { segments: segments.filter(s => s.korean.trim()).map(({ id, korean }) => ({ id, korean })), major: student.major, year, subjects: student.subjects.map(({ id, name }) => ({ id, name })) });
}
export function detectAssignments(lecture: { title: string; createdAt: string; subjectId: string | null; segments: Segment[] }, student: Student) {
 const subject = lecture.subjectId ? student.subjects.find(item => item.id === lecture.subjectId) : null;
 return aiRequest<AssignmentResult>("/api/assignments", {
  lectureTitle: lecture.title,
  lectureDate: lecture.createdAt,
  timezone: "Asia/Seoul",
  subjectId: lecture.subjectId,
  subjectName: subject?.name ?? "",
  segments: lecture.segments.filter(segment => segment.korean.trim() || segment.english.trim()).map(({ id, korean, english, seconds }) => ({ id, korean, english, seconds })),
 });
}
export function speakEnglish(text: string) {
 if (!("speechSynthesis" in window)) return false;
 const voice = new SpeechSynthesisUtterance(text); voice.lang = "en-US"; voice.rate = 0.92;
 const english = speechSynthesis.getVoices().find(v => v.lang.startsWith("en")); if (english) voice.voice = english;
 speechSynthesis.speak(voice); return true;
}
