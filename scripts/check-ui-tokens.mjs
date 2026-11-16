/**
 * Static design-token guard for Stage UI1+ panel surfaces and shared UI kits.
 * Fails (exit 1) when enforced panel targets contain raw palette classes
 * (bg-white, text-slate-*, bg-blue-*, etc.), raw hex colors, micro-fonts (<12px),
 * decorative gradients, uppercase+tracking labels, or interface emojis.
 *
 * Legacy un-migrated panel pages (UI2/UI3/UI4 scope) are audited separately
 * and printed as an informational backlog counter without failing UI1 builds.
 */

import fs from "fs";
import path from "path";

const ROOT = process.cwd();

const EXCLUDED_DIRS = new Set([
  "src/components/landing",
  "src/components/auth",
]);

const ENFORCED_TARGETS = [
  "src/components",
  "src/config/navigation.ts",
  "src/app/dev/ui-kit",
  "src/app/account",
  "src/app/center",
  "src/app/platform-admin",
  "src/app/developer",
];

const BACKLOG_DIRS = [
  "src/app/center",
  "src/app/platform-admin",
  "src/app/developer",
  "src/components",
];

const CODE_EXTENSIONS = new Set([".ts", ".tsx"]);

const RAW_TAILWIND_COLORS =
  /(?:^|[\s"'`:/])(?:(?:hover|focus|focus-visible|active|disabled|group-hover|dark|sm|md|lg|xl):)*(?:bg|text|border|ring|divide|from|via|to|fill|stroke|outline)-(?:white|black|(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950))(?=$|[\s"'`/\]])/;

const HEX_COLOR = /#[0-9a-fA-F]{3,8}\b/;
const MICRO_FONT = /\btext-\[(?:[1-9]|1[01])px\]/;
const GRADIENT_BG = /\bbg-gradient-to-/;
const EMOJI_CHAR = /\p{Extended_Pictographic}/u;

function walkFiles(targetRel) {
  const normRel = targetRel.replace(/\\/g, "/");
  if (EXCLUDED_DIRS.has(normRel)) return [];
  const full = path.join(ROOT, targetRel);
  if (!fs.existsSync(full)) return [];
  const stat = fs.statSync(full);
  if (stat.isFile()) {
    return CODE_EXTENSIONS.has(path.extname(full)) ? [full] : [];
  }
  const out = [];
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    const childRel = path.join(targetRel, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkFiles(childRel));
    } else if (CODE_EXTENSIONS.has(entry.name ? path.extname(entry.name) : "")) {
      out.push(path.join(ROOT, childRel));
    }
  }
  return out;
}

function stripCommentsAndStringsForEmojiSafe(line) {
  return line;
}

function scanFile(filePath) {
  const rel = path.relative(ROOT, filePath).replace(/\\/g, "/");
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  const violations = [];

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    const trimmed = line.trim();
    // Skip single-line comment documentation
    if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) {
      continue;
    }

    const lineNum = idx + 1;
    const rawMatch = line.match(RAW_TAILWIND_COLORS);
    if (rawMatch) {
      violations.push({ file: rel, line: lineNum, rule: "raw-tailwind-color", detail: rawMatch[0].trim() });
    }
    const hexMatch = line.match(HEX_COLOR);
    if (hexMatch && !line.includes("&#") && !line.includes("http")) {
      violations.push({ file: rel, line: lineNum, rule: "raw-hex-color", detail: hexMatch[0] });
    }
    const microMatch = line.match(MICRO_FONT);
    if (microMatch) {
      violations.push({ file: rel, line: lineNum, rule: "micro-font-<12px", detail: microMatch[0] });
    }
    if (GRADIENT_BG.test(line)) {
      violations.push({ file: rel, line: lineNum, rule: "gradient-decoration", detail: "bg-gradient-to-*" });
    }
    if (/\buppercase\b/.test(line) && /\btracking-(?:wider|widest)\b/.test(line)) {
      violations.push({ file: rel, line: lineNum, rule: "uppercase-wide-tracking", detail: trimmed.slice(0, 80) });
    }
    const stripped = stripCommentsAndStringsForEmojiSafe(line);
    const emojiMatch = stripped.match(EMOJI_CHAR);
    if (emojiMatch) {
      violations.push({ file: rel, line: lineNum, rule: "emoji-forbidden", detail: emojiMatch[0] });
    }
  }

  return violations;
}

const enforcedSet = new Set();
for (const target of ENFORCED_TARGETS) {
  for (const file of walkFiles(target)) {
    enforcedSet.add(file);
  }
}

const enforcedViolations = [];
for (const file of Array.from(enforcedSet).sort()) {
  enforcedViolations.push(...scanFile(file));
}

// Legacy backlog count (UI2/UI3/UI4 informational)
let backlogFilesCount = 0;
let backlogViolationsCount = 0;
const seenBacklog = new Set();
for (const dir of BACKLOG_DIRS) {
  for (const file of walkFiles(dir)) {
    const rel = path.relative(ROOT, file).replace(/\\/g, "/");
    if (
      enforcedSet.has(file) ||
      rel.startsWith("src/components/landing/") ||
      seenBacklog.has(file)
    ) {
      continue;
    }
    seenBacklog.add(file);
    const hits = scanFile(file);
    if (hits.length > 0) {
      backlogFilesCount++;
      backlogViolationsCount += hits.length;
    }
  }
}

console.log(
  `UI Token Check: scanned ${enforcedSet.size} enforced files (UI1 scope).`
);
console.log(
  `Legacy panel backlog (UI2/UI3/UI4 informational): ${backlogFilesCount} files with ${backlogViolationsCount} raw token hits.`
);

if (enforcedViolations.length > 0) {
  console.error(`\nFAIL: found ${enforcedViolations.length} forbidden style/token usage(s) in UI1 scope:`);
  for (const v of enforcedViolations) {
    console.error(`  - ${v.file}:${v.line} [${v.rule}] ${v.detail}`);
  }
  process.exit(1);
}

console.log("PASS: 0 forbidden colors, hex values, gradients, micro-fonts, or emojis in UI1 scope.");
