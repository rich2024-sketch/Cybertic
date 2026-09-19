import { z } from "zod";
import { newId, type Store } from "./types";

const id = z.string().trim().min(1).max(100);
const shortText = z.string().trim().min(1).max(100);
const mediumText = z.string().trim().min(1).max(150);
const longText = z.string().trim().min(1).max(8000);

export const subjectSchema = z.object({
  id,
  name: shortText,
  code: z.string().trim().max(40),
  color: z.string().trim().min(1).max(20),
});

export const studentSchema = z.object({
  id,
  name: z.string().trim().min(1).max(80),
  major: shortText,
  year: z.number().int().min(1).max(6),
  school: z.string().trim().min(1).max(120),
  subjects: z.array(subjectSchema).max(20),
}).superRefine((student, ctx) => {
  const ids = student.subjects.map(subject => subject.id);
  if (new Set(ids).size !== ids.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Subject IDs must be unique." });
  }
});

export const segmentSchema = z.object({
  id,
  seconds: z.number().finite().min(0).max(60 * 60 * 12),
  korean: z.string().trim().min(1).max(45000),
  english: z.string().max(45000),
});

const questionSchema = z.object({
  question: z.string().trim().min(1).max(1500),
  options: z.array(z.string().trim().min(1).max(800)).min(2).max(4),
  answer: z.number().int().min(0).max(3),
  explanation: z.string().trim().min(1).max(2000),
}).superRefine((question, ctx) => {
  if (question.answer >= question.options.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Question answers must point to an existing option." });
  }
});

const notesSchema = z.object({
  overview: longText,
  takeaways: z.array(z.string().trim().min(1).max(3000)).min(1).max(12),
  terms: z.array(z.object({
    term: z.string().trim().min(1).max(150),
    korean: z.string().max(150),
    explanation: z.string().trim().min(1).max(2000),
  })).max(12),
  questions: z.array(questionSchema).length(3),
});

export const lectureSchema = z.object({
  id,
  studentId: id,
  subjectId: z.string().trim().min(1).max(100).nullable(),
  title: mediumText,
  createdAt: z.string().datetime(),
  duration: z.number().finite().min(0).max(60 * 60 * 12),
  mode: z.enum(["sample", "recording"]),
  sampleId: z.string().trim().min(1).max(100).optional(),
  segments: z.array(segmentSchema).max(200),
  notes: notesSchema.nullable(),
  notesYear: z.number().int().min(1).max(6),
  hasAudio: z.boolean(),
  quizAnswers: z.record(z.string().regex(/^\d+$/), z.number().int().min(0).max(3)),
}).superRefine((lecture, ctx) => {
  const total = lecture.segments.reduce((count, segment) => count + segment.korean.length, 0);
  if (total > 45000) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Lecture transcripts must stay within the 45,000 character prototype limit." });
  }
  const ids = lecture.segments.map(segment => segment.id);
  if (new Set(ids).size !== ids.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Lecture segment IDs must be unique." });
  }
});

export const storeSchema = z.object({
  version: z.literal(1),
  students: z.array(studentSchema).length(1),
  activeStudentId: id,
  lectures: z.array(lectureSchema).max(500),
}).superRefine((store, ctx) => {
  const student = store.students[0];
  if (store.activeStudentId !== student.id) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "The active student must match the authenticated student's profile." });
  }
  const subjectIds = new Set(student.subjects.map(subject => subject.id));
  for (const lecture of store.lectures) {
    if (lecture.studentId !== student.id) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Lecture ${lecture.id} does not belong to the authenticated student.` });
    }
    if (lecture.subjectId && !subjectIds.has(lecture.subjectId)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Lecture ${lecture.id} references a subject that is not in the current profile.` });
    }
  }
});

export const profileSetupSchema = z.object({
  name: z.string().trim().min(1).max(80),
  major: shortText,
  year: z.number().int().min(1).max(6),
  school: z.string().trim().min(1).max(120),
  subjects: z.array(subjectSchema).max(20),
});

export type ProfileSetup = z.infer<typeof profileSetupSchema>;

export function normalizeStore(raw: unknown): Store {
  return storeSchema.parse(raw) as Store;
}

export function createStoreFromProfile(profile: ProfileSetup, studentId = newId()): Store {
  return {
    version: 1,
    students: [{
      id: studentId,
      name: profile.name.trim(),
      major: profile.major.trim(),
      year: profile.year,
      school: profile.school.trim(),
      subjects: profile.subjects.map(subject => ({
        ...subject,
        name: subject.name.trim(),
        code: subject.code.trim(),
      })),
    }],
    activeStudentId: studentId,
    lectures: [],
  };
}

export function mergeProfileIntoStore(store: Store | null, profile: ProfileSetup): Store {
  if (!store) return createStoreFromProfile(profile);
  const current = normalizeStore(store);
  const existing = current.students[0];
  const next = createStoreFromProfile(profile, existing.id);
  const allowedSubjectIds = new Set(next.students[0].subjects.map(subject => subject.id));
  next.lectures = current.lectures.map(lecture => ({
    ...lecture,
    studentId: existing.id,
    subjectId: lecture.subjectId && allowedSubjectIds.has(lecture.subjectId) ? lecture.subjectId : null,
  }));
  return normalizeStore(next);
}
