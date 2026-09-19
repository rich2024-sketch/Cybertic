import { z } from "zod";
import { apiFailure, generateJSON, readBody } from "@/lib/studymate/ai-server";

const assignmentInput = z.object({
  lectureTitle: z.string().trim().min(1).max(150),
  lectureDate: z.string().datetime(),
  timezone: z.string().trim().min(1).max(80),
  subjectId: z.string().max(100).nullable(),
  subjectName: z.string().max(100),
  segments: z.array(z.object({
    id: z.string().min(1).max(100),
    seconds: z.number().finite().min(0).max(60 * 60 * 12),
    korean: z.string().max(45000),
    english: z.string().max(45000),
  })).min(1).max(200),
}).refine(data => data.segments.some(segment => segment.korean.trim() || segment.english.trim()), {
  message: "Provide at least one transcript segment.",
});

const assignmentOutput = z.object({
  items: z.array(z.object({
    kind: z.enum(["assignment", "exam", "deadline"]),
    title: z.string().trim().min(1).max(150),
    instructions: z.string().trim().min(1).max(4000),
    deadlineLabel: z.string().trim().min(1).max(120),
    deadlineDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    deadlineTimeText: z.string().max(120),
    deadlineAt: z.string().datetime().nullable(),
    excerpt: z.string().trim().min(1).max(2000),
    needsConfirmation: z.boolean(),
  })).max(30),
});

export async function POST(request: Request) {
  try {
    const input = assignmentInput.parse(await readBody(request));
    const result = await generateJSON(
      "You review a saved Korean university lecture transcript and extract only concrete assignments, exams, quizzes, presentations, homework, submissions, and deadlines that the transcript actually mentions. Use the lecture date and the provided timezone when resolving relative deadlines. Never invent an assignment, title, date, time, or instruction. If the deadline is missing or ambiguous, keep deadlineDate and deadlineAt as null, keep a short deadlineLabel such as 'Needs confirmation', and set needsConfirmation=true. If nothing actionable is mentioned, return {\"items\":[]}. Output this JSON structure exactly: {items:[{kind:'assignment'|'exam'|'deadline',title:string,instructions:string,deadlineLabel:string,deadlineDate:'YYYY-MM-DD'|null,deadlineTimeText:string,deadlineAt:string|null,excerpt:string,needsConfirmation:boolean}] }.",
      input,
      5000,
    );
    return Response.json(assignmentOutput.parse(result));
  } catch (error) {
    return apiFailure(error);
  }
}
