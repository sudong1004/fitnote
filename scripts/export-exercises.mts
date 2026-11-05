/**
 * prisma/seed.ts 의 운동·기구를 docs/EXERCISES.md 로 뽑는다.
 * 사용: npx tsx scripts/export-exercises.mts
 */
import { readFileSync, writeFileSync } from "node:fs";

const src = readFileSync("prisma/seed.ts", "utf8");
const i = src.indexOf("const equipments");
const j = src.indexOf("const exercises");
const k = src.indexOf("// WORKOUT ALTERNATIVE");

const equipments = [
  ...src
    .slice(i, j)
    .matchAll(/name: "([^"]+)",\s*category: EquipmentCategory\.(\w+)/g),
].map((m) => ({ name: m[1], category: m[2] }));

const exercises = [
  ...src
    .slice(j, k)
    .matchAll(
      /name: "([^"]+)",\s*bodyPart: WorkoutBodyPart\.(\w+),\s*targetMuscle: "([^"]*)",\s*movementType: ExerciseMovementType\.(\w+),\s*difficulty: Difficulty\.(\w+),[\s\S]*?equipment: \[([^\]]*)\]/g,
    ),
].map((m) => ({
  name: m[1],
  part: m[2],
  target: m[3],
  level: m[5],
  equipment: [...m[6].matchAll(/"([^"]+)"/g)].map((x) => x[1]).join(", "),
}));

const PART: Record<string, string> = {
  CHEST: "가슴", BACK: "등", SHOULDER: "어깨", ARM: "팔", LEG: "하체",
  GLUTE: "둔근", ABS: "복근", FULL_BODY: "전신", CARDIO: "유산소",
};
const LEVEL: Record<string, string> = { BEGINNER: "초급", INTERMEDIATE: "중급", ADVANCED: "고급" };
const CAT: Record<string, string> = {
  FREE_WEIGHT: "프리웨이트", MACHINE: "머신", CABLE: "케이블", CARDIO: "유산소",
  BODYWEIGHT: "맨몸", BAND: "밴드", OTHER: "기타",
};

const today = new Date().toISOString().slice(0, 10);
const out = [
  `# 운동 라이브러리 목록\n\n\`prisma/seed.ts\` 에서 뽑은 목록이다. 운동 ${exercises.length}개, 기구 ${equipments.length}개 (${today} 기준).`,
  "운동을 더하면 시드를 고친 뒤 `npx tsx scripts/export-exercises.mts` 로 이 파일을 다시 뽑는다.",
  "운영 DB 에는 `npx prisma db seed` 를 해야 앱에 나온다.\n",
];

for (const [part, label] of Object.entries(PART)) {
  const rows = exercises.filter((e) => e.part === part);
  out.push(`\n## ${label} (${rows.length})\n\n| 운동 | 자극 부위 | 난이도 | 기구 |\n| --- | --- | --- | --- |`);
  for (const e of rows) out.push(`| ${e.name} | ${e.target} | ${LEVEL[e.level]} | ${e.equipment} |`);
}

out.push(`\n## 기구 (${equipments.length})\n`);
for (const [cat, label] of Object.entries(CAT)) {
  const names = equipments.filter((e) => e.category === cat).map((e) => e.name);
  if (names.length) out.push(`- **${label} (${names.length})**: ${names.join(", ")}`);
}

writeFileSync("docs/EXERCISES.md", out.join("\n") + "\n");
console.log(exercises.length, equipments.length);
