import { apiFailure, generateJSON, readBody, studyInput, validateStudyResult } from "@/lib/studymate/ai-server";
export async function POST(request: Request) {
 try {
  const input = studyInput.parse(await readBody(request));
  const instruction = "You help international students understand Korean university lectures in English, across all disciplines. Translate every supplied segment; return its unchanged id. Suggest exactly one subjectId from the enrolled subjects only when the transcript supports it; otherwise use null. Never invent a subject ID. Create a short lecture title. Summarise only what the transcript supports. Adapt explanation depth to academic year, using more definitions in early years and more concise technical language in later years. Preserve the same facts at every level. GPA is not a measure of ability. Explain key Korean/English terms. If the input is unclear or incomplete, say so in the notes. Create exactly 3 answerable review questions with 2–4 options each, a zero-based correct answer index, and an explanation. Use this JSON structure: {title:string,subjectId:string|null,notes:{overview:string,takeaways:string[],terms:[{term:string,korean:string,explanation:string}],questions:[{question:string,options:string[],answer:number,explanation:string}]},translations:[{id:string,english:string}]}.";
  const result = await generateJSON(instruction, input, 12000);
  return Response.json(validateStudyResult(result, input));
 } catch (e) { return apiFailure(e); }
}
