import assert from "node:assert/strict";
import { test, after } from "node:test";
import { mkdir, mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

// Exercise product rules without a paid AI call or a browser dependency.
const root = process.cwd();
await mkdir(path.join(root, ".sites-runtime"), { recursive: true });
const temp = await mkdtemp(path.join(root, ".sites-runtime", "studymate-tests-"));
for (const file of ["types", "demo", "storage", "ai-server", "workspace"]) {
 const source = await readFile(path.join(root, "lib/studymate", file + ".ts"), "utf8");
 const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } });
 await writeFile(path.join(temp, file + ".js"), outputText.replace(/from "\.\/(types|demo|workspace)"/g, 'from "./$1.js"'));
}
const load = name => import(pathToFileURL(path.join(temp, name + ".js")).href);
const { initialStore, samples, sampleNotes } = await load("demo");
const { moveLecture } = await load("types");
const { readStore, writeStore } = await load("storage");
const { liveConfig, generateJSON, readBody, studyInput, validateStudyResult } = await load("ai-server");
const { createStoreFromProfile, mergeProfileIntoStore, normalizeStore } = await load("workspace");
const memory = new Map();
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: k => memory.get(k) ?? null, setItem: (k, v) => memory.set(k, v) } });
after(async () => { await rm(temp, { recursive: true, force: true }); });

test("demo accounts have disjoint subjects and start without fabricated recordings", () => {
 const state = initialStore(); assert.equal(state.lectures.length, 0); assert.notEqual(state.students[0].major, state.students[1].major);
 const ids = state.students.flatMap(s => s.subjects.map(x => x.id)); assert.equal(ids.length, new Set(ids).size);
});
test("editing and refreshing one profile preserves the other", () => {
 memory.clear(); const state = initialStore(); const other = structuredClone(state.students[1]);
 state.students[0].year = 4; state.students[0].subjects[0].name = "Cell Biology"; writeStore(state);
 const loaded = readStore(); assert.equal(loaded.students[0].year, 4); assert.deepEqual(loaded.students[1], other);
});
test("unreadable stored data is not silently overwritten", () => {
 memory.set("studymate-v1", "broken-json"); assert.throws(readStore); assert.equal(memory.get("studymate-v1"), "broken-json"); memory.clear();
});
test("cross-account lecture moves and unknown subject IDs are rejected", () => {
 const [student, other] = initialStore().students; const lecture = { studentId: student.id, subjectId: student.subjects[0].id };
 assert.throws(() => moveLecture(lecture, other.subjects[0].id, student)); assert.throws(() => moveLecture(lecture, null, other));
 assert.equal(moveLecture(lecture, student.subjects[1].id, student).subjectId, student.subjects[1].id); assert.equal(moveLecture(lecture, null, student).subjectId, null);
});
test("summary levels differ without mutating prepared sample notes", () => {
 const first = sampleNotes(samples[0], 1), fourth = sampleNotes(samples[0], 4); assert.notEqual(first.overview, fourth.overview);
 first.takeaways.length = 0; assert.ok(sampleNotes(samples[0], 1).takeaways.length > 0);
});
test("every demo quiz has exactly three questions and valid answer indices", () => {
 for (const sample of samples) for (const level of [1, 4]) { const notes = sampleNotes(sample, level); assert.equal(notes.questions.length, 3); for (const q of notes.questions) assert.ok(q.answer >= 0 && q.answer < q.options.length); }
});
test("live AI stays disabled until explicitly configured", async () => {
 const keys = ["STUDYMATE_ENABLE_LIVE_AI", "OPENAI_API_KEY", "OPENAI_BASE_URL", "OPENAI_MODEL", "GEMINI_LIVE_API_KEY", "GEMINI_TEXT_MODEL"];
 const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
 process.env.STUDYMATE_ENABLE_LIVE_AI = "false";
 delete process.env.OPENAI_API_KEY;
 delete process.env.OPENAI_BASE_URL;
 delete process.env.OPENAI_MODEL;
 delete process.env.GEMINI_LIVE_API_KEY;
 delete process.env.GEMINI_TEXT_MODEL;
 assert.equal(liveConfig().enabled, false);
 await assert.rejects(generateJSON("test", {}, 10), /not connected/);
 for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
});

test("live AI can use the direct Gemini text backend with the existing Gemini key", () => {
 const keys = ["STUDYMATE_ENABLE_LIVE_AI", "OPENAI_API_KEY", "OPENAI_BASE_URL", "OPENAI_MODEL", "GEMINI_LIVE_API_KEY", "GEMINI_TEXT_MODEL"];
 const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
 Object.assign(process.env, {
  STUDYMATE_ENABLE_LIVE_AI: "true",
  GEMINI_LIVE_API_KEY: "test-gemini-key",
  GEMINI_TEXT_MODEL: "gemini-2.5-flash",
 });
 delete process.env.OPENAI_API_KEY;
 delete process.env.OPENAI_BASE_URL;
 delete process.env.OPENAI_MODEL;
 const config = liveConfig();
 assert.equal(config.enabled, true);
 assert.equal(config.provider, "gemini");
 assert.equal(config.model, "gemini-2.5-flash");
 for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
});

test("OpenAI proxy config still takes precedence when explicitly configured", () => {
 const keys = ["STUDYMATE_ENABLE_LIVE_AI", "OPENAI_API_KEY", "OPENAI_BASE_URL", "OPENAI_MODEL", "GEMINI_LIVE_API_KEY", "GEMINI_TEXT_MODEL"];
 const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
 Object.assign(process.env, {
  STUDYMATE_ENABLE_LIVE_AI: "true",
  OPENAI_API_KEY: "proxy-key",
  OPENAI_BASE_URL: "https://proxy.example/v1",
  OPENAI_MODEL: "gpt-5.4-mini",
  GEMINI_LIVE_API_KEY: "gemini-key",
  GEMINI_TEXT_MODEL: "gemini-2.5-flash",
 });
 const config = liveConfig();
 assert.equal(config.enabled, true);
 assert.equal(config.provider, "openai");
 assert.equal(config.baseUrl, "https://proxy.example/v1");
 for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
});
test("AI cannot silently file lectures under invented classes", () => {
 const input = studyInput.parse({ major: "Biology", year: 1, subjects: [{ id: "bio", name: "Biology" }], segments: [{ id: "one", korean: "세포막" }] });
 const result = { title: "Membranes", subjectId: "invented", notes: sampleNotes(samples[0], 1), translations: [{ id: "one", english: "Cell membrane" }] };
 assert.equal(validateStudyResult(result, input).subjectId, null);
 assert.throws(() => validateStudyResult({ ...result, translations: [{ id: "wrong", english: "Text" }] }, input), /every transcript/);
});
test("API rejects cross-origin and oversized requests before provider work", async () => {
 const keys = ["STUDYMATE_ENABLE_LIVE_AI", "OPENAI_API_KEY", "OPENAI_BASE_URL", "OPENAI_MODEL", "GEMINI_LIVE_API_KEY", "GEMINI_TEXT_MODEL", "STUDYMATE_APP_ORIGIN"];
 const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
 Object.assign(process.env, { STUDYMATE_ENABLE_LIVE_AI: "true", OPENAI_API_KEY: "test-only-not-a-real-key", OPENAI_BASE_URL: "https://proxy.example/v1", OPENAI_MODEL: "test-model", STUDYMATE_APP_ORIGIN: "https://study.example" });
 try {
  await assert.rejects(readBody(new Request("https://study.example/api/study", { method: "POST", headers: { origin: "https://other.example", "content-type": "application/json" }, body: "{}" })), e => e.status === 403);
  await assert.rejects(readBody(new Request("https://study.example/api/study", { method: "POST", headers: { origin: "https://study.example", "content-type": "application/json" }, body: JSON.stringify({ text: "x".repeat(210000) }) })), e => e.status === 413);
 } finally { for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } }
});

test("authenticated profile creation starts with one active student", () => {
 const store = createStoreFromProfile({
  name: "Amina Yusuf",
  school: "Korea University",
  major: "Linguistics",
  year: 2,
  subjects: [{ id: "ling-101", name: "Phonetics", code: "LING 101", color: "blue" }],
 });
 assert.equal(store.students.length, 1);
 assert.equal(store.activeStudentId, store.students[0].id);
 assert.equal(store.lectures.length, 0);
});

test("profile updates keep lectures but unfile removed subjects", () => {
 const original = createStoreFromProfile({
  name: "Mina Park",
  school: "Yonsei University",
  major: "Biology",
  year: 1,
  subjects: [
   { id: "bio-1", name: "Biology", code: "BIO 101", color: "blue" },
   { id: "chem-1", name: "Chemistry", code: "CHEM 101", color: "teal" },
  ],
 });
 const student = original.students[0];
 original.lectures.push({
  id: "lecture-1",
  studentId: student.id,
  subjectId: "chem-1",
  title: "Acids and bases",
  createdAt: new Date("2026-09-19T00:00:00.000Z").toISOString(),
  duration: 1800,
  mode: "recording",
  segments: [{ id: "seg-1", seconds: 0, korean: "산과 염기", english: "Acids and bases" }],
  notes: null,
  notesYear: 1,
  hasAudio: false,
  quizAnswers: {},
 });
 const updated = mergeProfileIntoStore(original, {
  name: student.name,
  school: student.school,
  major: "Biochemistry",
  year: 2,
  subjects: [{ id: "bio-1", name: "Biology", code: "BIO 101", color: "blue" }],
 });
 assert.equal(updated.students[0].major, "Biochemistry");
 assert.equal(updated.lectures[0].subjectId, null);
 assert.equal(updated.lectures[0].studentId, student.id);
});

test("workspace normalization rejects multiple student profiles", () => {
 assert.throws(() => normalizeStore({
  version: 1,
  activeStudentId: "a",
  students: [
   { id: "a", name: "One", major: "Biology", year: 1, school: "Test", subjects: [] },
   { id: "b", name: "Two", major: "History", year: 2, school: "Test", subjects: [] },
  ],
  lectures: [],
 }), /exactly 1 element|one active student|array/i);
});
