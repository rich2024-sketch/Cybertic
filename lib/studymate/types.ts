export type Subject = { id: string; name: string; code: string; color: string };
export type Student = { id: string; name: string; major: string; year: number; school: string; subjects: Subject[] };
export type Segment = { id: string; seconds: number; korean: string; english: string };
export type Question = { question: string; options: string[]; answer: number; explanation: string };
export type StudyNotes = { overview: string; takeaways: string[]; terms: { term: string; korean: string; explanation: string }[]; questions: Question[] };
export type Lecture = { id: string; studentId: string; subjectId: string | null; title: string; createdAt: string; duration: number; mode: "sample" | "recording"; sampleId?: string; segments: Segment[]; notes: StudyNotes | null; notesYear: number; hasAudio: boolean; quizAnswers: Record<number, number> };
export type Store = { version: 1; students: Student[]; activeStudentId: string | null; lectures: Lecture[] };
export type Sample = { id: string; subject: string; title: string; segments: Omit<Segment, "id">[]; foundational: StudyNotes; advanced: StudyNotes };
export const newId = () => crypto.randomUUID();
export const formatDuration = (s: number) => Math.floor(s / 60).toString().padStart(2, "0") + ":" + Math.floor(s % 60).toString().padStart(2, "0");
export const yearLabel = (year: number) => "Year " + year;
export const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(p => p[0]).join("").toUpperCase();
export function moveLecture(lecture: Lecture, subjectId: string | null, student: Student): Lecture {
  if (lecture.studentId !== student.id) throw new Error("This lecture belongs to another student.");
  if (subjectId && !student.subjects.some(s => s.id === subjectId)) throw new Error("Choose one of your enrolled subjects.");
  return { ...lecture, subjectId };
}
