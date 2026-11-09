import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const rootDir = process.cwd();
const mobileDir = path.join(rootDir, "mobile");
const outputDir = path.join(rootDir, "dist", "mobile-release");
const reportsDir = path.join(rootDir, "reports");

if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
}

const logFile = path.join(reportsDir, "release_bundle_check.log");
const startTime = new Date().toISOString();
let logOutput = `[${startTime}] Starting Release Bundle Security Verification\n\n`;

console.log("Building mobile release bundle (NODE_ENV=production, platform=android)...");
logOutput += "1. Building mobile release bundle with Expo CLI...\n";

try {
  const buildCmd = "npx expo export --platform android --no-bytecode --output-dir ../dist/mobile-release";
  const buildOut = execSync(buildCmd, {
    cwd: mobileDir,
    encoding: "utf8",
    env: {
      ...process.env,
      NODE_ENV: "production",
      EXPO_PUBLIC_API_URL: "https://app.edarschi.uz",
    },
  });
  logOutput += buildOut + "\nBundle export finished successfully.\n\n";
} catch (err) {
  const errMsg = `Bundle export failed: ${err.message}`;
  console.error(errMsg);
  logOutput += errMsg + "\n";
  fs.writeFileSync(logFile, logOutput);
  process.exit(1);
}

// Recursively find all js bundle files in outputDir
function getJsFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getJsFiles(fullPath));
    } else if (file.endsWith(".js")) {
      results.push(fullPath);
    }
  }
  return results;
}

const jsFiles = getJsFiles(outputDir);
console.log(`Found ${jsFiles.length} JS bundle file(s) to scan in ${outputDir}`);
logOutput += `2. Scanning ${jsFiles.length} JS bundle file(s) for security violations...\n`;

const FORBIDDEN_PATTERNS = [
  { name: "Demo Password 'MobilePass123!'", regex: /MobilePass123!/g },
  { name: "Demo Password 'Password123!'", regex: /Password123!/g },
  { name: "Test email '@example.com'", regex: /[a-zA-Z0-9._%+-]+@example\.com/g },
  { name: "Demo email 'director@edarschi.uz'", regex: /director@edarschi\.uz/g },
  { name: "Demo email 'teacher@edarschi.uz'", regex: /teacher@edarschi\.uz/g },
  { name: "Demo email 'student@edarschi.uz'", regex: /student@edarschi\.uz/g },
  { name: "Demo email 'parent@edarschi.uz'", regex: /parent@edarschi\.uz/g },
  { name: "Local LAN IP '192.168.'", regex: /192\.168\.\d{1,3}\.\d{1,3}/g },
  { name: "Android Emulator LAN IP '10.0.2.2'", regex: /10\.0\.2\.2/g },
  { name: "Insecure HTTP API URL", regex: /http:\/\/(?!www\.w3\.org)[a-zA-Z0-9.-]+(:\d+)?\/api/g },
];

let totalViolations = 0;

for (const filePath of jsFiles) {
  const relPath = path.relative(rootDir, filePath);
  const content = fs.readFileSync(filePath, "utf8");
  logOutput += `\nScanning: ${relPath} (${(content.length / 1024 / 1024).toFixed(2)} MB)\n`;

  for (const pattern of FORBIDDEN_PATTERNS) {
    const matches = content.match(pattern.regex);
    if (matches && matches.length > 0) {
      totalViolations += matches.length;
      const violationMsg = `[FAIL] Found forbidden pattern "${pattern.name}" (${matches.length} matches)`;
      console.error(`  ${violationMsg}`);
      logOutput += `  ${violationMsg}\n`;
    } else {
      logOutput += `  [PASS] ${pattern.name}: Clean\n`;
    }
  }
}

const endTime = new Date().toISOString();
logOutput += `\n[${endTime}] Verification finished. Total violations: ${totalViolations}\n`;

fs.writeFileSync(logFile, logOutput);
console.log(`Scan complete. Violations: ${totalViolations}. Detailed log saved to: ${logFile}`);

if (totalViolations > 0) {
  process.exit(1);
} else {
  console.log("All security bundle checks passed with 0 violations!");
  process.exit(0);
}
