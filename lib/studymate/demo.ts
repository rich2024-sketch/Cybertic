import type { Sample, Store, StudyNotes } from "./types";
const bioQuiz = [
 { question: "What does a selectively permeable membrane do?", options: ["Lets every substance pass equally", "Controls which substances pass through", "Stops everything from entering"], answer: 1, explanation: "A membrane permits some substances to cross more easily than others." },
 { question: "Diffusion moves particles down their concentration gradient.", options: ["True", "False"], answer: 0, explanation: "Net movement is from a higher concentration to a lower concentration." },
 { question: "How does active transport differ from simple diffusion?", options: ["It always moves water", "It needs energy to move against a gradient", "It does not use the membrane"], answer: 1, explanation: "Active transport uses energy to move substances against their concentration gradient." },
];
const historyQuiz = [
 { question: "Which is a primary source for studying a historical event?", options: ["A diary written during the event", "A present-day textbook", "A recent documentary summary"], answer: 0, explanation: "A contemporary diary is evidence from the period, although it may still be biased." },
 { question: "Primary sources are always unbiased.", options: ["True", "False"], answer: 1, explanation: "Who made a source, why, and for whom can shape what it says and leaves out." },
 { question: "What does comparing independent sources help a historian do?", options: ["Avoid checking context", "Treat every account as equally reliable", "Assess claims and identify disagreements"], answer: 2, explanation: "Corroboration helps evaluate evidence; disagreement can reveal perspective or missing context." },
];
export const samples: Sample[] = [
 { id: "biology", subject: "General Biology", title: "Cell membranes & transport", segments: [
   { seconds: 0, korean: "오늘은 세포막과 물질 이동에 대해 배우겠습니다. 세포막은 세포 안과 밖을 구분하는 경계입니다.", english: "Today we will study cell membranes and the movement of substances. The cell membrane forms the boundary between the inside and outside of a cell." },
   { seconds: 18, korean: "세포막은 인지질 이중층으로 이루어져 있습니다. 선택적 투과성이 있어서 어떤 물질은 통과시키고 다른 물질의 이동은 제한합니다.", english: "The cell membrane consists of a phospholipid bilayer. It is selectively permeable: it allows some substances through while restricting others." },
   { seconds: 38, korean: "확산은 입자가 농도가 높은 곳에서 낮은 곳으로 이동하는 현상입니다. 이 과정에는 세포의 에너지가 직접 필요하지 않습니다.", english: "Diffusion is the net movement of particles from higher to lower concentration. It does not directly require cellular energy." },
   { seconds: 59, korean: "삼투는 선택적 투과성 막을 통한 물의 이동입니다. 물은 용질 농도가 낮은 쪽에서 높은 쪽으로 이동합니다.", english: "Osmosis is the movement of water through a selectively permeable membrane toward a higher solute concentration." },
   { seconds: 79, korean: "능동 수송은 농도 기울기에 거슬러 물질을 이동시킵니다. 따라서 에너지가 필요합니다. 확산과 능동 수송의 차이를 정리해 보세요.", english: "Active transport moves substances against their concentration gradient and requires energy. Review the difference between diffusion and active transport." },
 ], foundational: {
   overview: "A cell membrane is a boundary that controls what enters and leaves a cell. Substances cross it in different ways, depending on their concentration and whether energy is needed.",
   takeaways: ["The membrane has two layers of phospholipids and lets some substances pass more easily than others.", "Diffusion moves particles from a crowded area to a less crowded area, without directly using cellular energy.", "Osmosis is water moving across a selectively permeable membrane toward more dissolved solute.", "Active transport needs energy because it moves substances against their concentration gradient."],
   terms: [{ term: "Selective permeability", korean: "선택적 투과성", explanation: "The membrane controls what crosses it, rather than letting everything through equally." }, { term: "Diffusion", korean: "확산", explanation: "Net movement from a higher concentration to a lower concentration." }, { term: "Osmosis", korean: "삼투", explanation: "Water crosses a selectively permeable membrane toward a higher solute concentration." }, { term: "Active transport", korean: "능동 수송", explanation: "Movement against a concentration gradient that needs energy." }], questions: bioQuiz,
 }, advanced: {
   overview: "The phospholipid bilayer establishes a selectively permeable boundary. The lecture distinguishes passive movement down a concentration gradient from energy-dependent transport against that gradient.",
   takeaways: ["Membrane composition underlies selective permeability; crossing rates differ between substances.", "Simple diffusion is passive, with net movement down a concentration gradient.", "Osmosis describes net water movement toward greater solute concentration under the conditions discussed.", "Active transport requires energy to drive movement against a concentration gradient. The lecture does not specify molecular transporters."],
   terms: [{ term: "Phospholipid bilayer", korean: "인지질 이중층", explanation: "The two-layer phospholipid structure identified in the lecture as the membrane's structural boundary." }, { term: "Concentration gradient", korean: "농도 기울기", explanation: "A difference in concentration between regions; its direction distinguishes the passive and active transport described here." }, { term: "Selective permeability", korean: "선택적 투과성", explanation: "Differential passage of substances across a membrane, rather than unrestricted exchange." }], questions: bioQuiz,
 } },
 { id: "history", subject: "Historical Methods", title: "Reading history through evidence", segments: [
   { seconds: 0, korean: "역사 연구는 과거에 대한 질문을 만들고 사료를 분석하는 과정입니다. 오늘은 일차 사료와 이차 사료를 구분하겠습니다.", english: "Historical research involves asking questions about the past and analysing evidence. Today we will distinguish primary and secondary sources." },
   { seconds: 21, korean: "일차 사료는 연구하는 시대에 만들어진 기록입니다. 당시의 일기, 편지, 신문 등이 여기에 해당합니다.", english: "Primary sources are records produced during the period being studied, such as contemporary diaries, letters, and newspapers." },
   { seconds: 42, korean: "이차 사료는 이후에 일차 사료를 해석하고 분석한 자료입니다. 역사 교과서나 연구 논문이 대표적인 예입니다.", english: "Secondary sources interpret and analyse earlier evidence. History textbooks and research articles are common examples." },
   { seconds: 61, korean: "일차 사료라고 해서 언제나 객관적인 것은 아닙니다. 작성자, 작성 목적, 예상 독자를 함께 살펴봐야 합니다.", english: "A primary source is not necessarily objective. Consider its author, purpose, and intended audience." },
   { seconds: 82, korean: "독립적인 사료를 비교하면 주장을 검토하고 서로 다른 관점을 발견할 수 있습니다. 사료의 맥락을 확인하는 것이 중요합니다.", english: "Comparing independent sources helps evaluate claims and uncover different perspectives. Establishing the context of each source is essential." },
 ], foundational: {
   overview: "Historians use evidence to answer questions about the past. Understanding where a source came from helps you decide how to use it.",
   takeaways: ["Primary sources were made during the period being studied, such as a diary or letter.", "Secondary sources interpret earlier evidence, such as a history textbook.", "A source may reflect its author's purpose and audience, so it can be biased.", "Compare independent sources and check their context before accepting a claim."],
   terms: [{ term: "Primary source", korean: "일차 사료", explanation: "Evidence made during the historical period being studied." }, { term: "Secondary source", korean: "이차 사료", explanation: "A later interpretation or analysis of earlier evidence." }, { term: "Context", korean: "맥락", explanation: "The circumstances in which a source was created, including its purpose and audience." }], questions: historyQuiz,
 }, advanced: {
   overview: "Historical interpretation depends on distinguishing a source's origin from its reliability as evidence. Primary status does not guarantee objectivity: authorship, intended audience, and purpose require critical evaluation.",
   takeaways: ["Distinguish contemporary evidence from later interpretation relative to the research question.", "Assess the author's purpose and audience when interpreting claims and omissions.", "Compare independent sources to corroborate claims and investigate conflicting perspectives.", "Retain contextual differences when comparing accounts; a shared claim alone does not establish independence."],
   terms: [{ term: "Source criticism", korean: "사료 비판", explanation: "Evaluating authorship, purpose, audience, and context before using a source as evidence; this label describes the method discussed." }, { term: "Corroboration", korean: "교차 검증", explanation: "Comparing independent evidence to assess claims and identify discrepancies." }, { term: "Primary source", korean: "일차 사료", explanation: "A record contemporary to the period studied; relevance and reliability still require evaluation." }], questions: historyQuiz,
 } },
];
export function sampleNotes(sample: Sample, year: number): StudyNotes { return structuredClone(year <= 2 ? sample.foundational : sample.advanced); }
export function initialStore(): Store {
 return { version: 1, activeStudentId: null, lectures: [], students: [
  { id: "student-maya", name: "Maya Johnson", major: "Biology", year: 1, school: "Demo University", subjects: [
   { id: "maya-bio", name: "General Biology", code: "BIO 101", color: "blue" }, { id: "maya-chem", name: "General Chemistry", code: "CHEM 101", color: "teal" }, { id: "maya-stats", name: "Introduction to Statistics", code: "STAT 101", color: "orange" }, { id: "maya-korean", name: "Academic Korean", code: "KOR 101", color: "purple" },
  ] },
  { id: "student-daniel", name: "Daniel Mensah", major: "History", year: 3, school: "Demo University", subjects: [
   { id: "daniel-methods", name: "Historical Methods", code: "HIST 301", color: "orange" }, { id: "daniel-asia", name: "Modern East Asian History", code: "HIST 310", color: "blue" }, { id: "daniel-research", name: "Research Seminar", code: "HIST 320", color: "teal" },
  ] },
 ] };
}
