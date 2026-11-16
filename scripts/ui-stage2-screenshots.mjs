import { spawn, spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

if (fs.existsSync(".env")) {
  const envContent = fs.readFileSync(".env", "utf8");
  for (const line of envContent.split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const val = match[2].trim().replace(/^['"]|['"]$/g, "");
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

function getTestDbUrl() {
  if (process.env.DATABASE_URL_TEST) return process.env.DATABASE_URL_TEST;
  const base = process.env.DATABASE_URL;
  if (!base) throw new Error("DATABASE_URL or DATABASE_URL_TEST is required");
  return base.replace(/\/([^/?]+)(\?.*)?$/, "/lms_test$2");
}

const TEST_DB_URL = getTestDbUrl();
process.env.DATABASE_URL = TEST_DB_URL;

const prisma = new PrismaClient({
  datasources: { db: { url: TEST_DB_URL } },
});

const PANEL_THEME_COOKIE = "edarschi_panel_theme";
const PANEL_RESOLVED_COOKIE = "edarschi_panel_resolved_theme";

function findBrowser() {
  const candidates = [
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error("Neither Microsoft Edge nor Google Chrome binary was found");
}

async function isServerReady(port) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/login`, {
      signal: AbortSignal.timeout(5000),
    });
    return res.status === 200;
  } catch {
    return false;
  }
}

async function startDevServer(port) {
  console.log(`Starting isolated Next.js dev server on port ${port} (DB: lms_test)...`);
  const proc = spawn("cmd.exe", ["/c", "npx", "next", "dev", "-H", "127.0.0.1", "-p", String(port)], {
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: "development",
      DATABASE_URL: TEST_DB_URL,
      DIRECT_URL: TEST_DB_URL,
    },
  });

  proc.stdout.on("data", (chunk) => {
    const s = chunk.toString().trim();
    if (s) console.log(`[next-dev] ${s}`);
  });
  proc.stderr.on("data", (chunk) => {
    const s = chunk.toString().trim();
    if (s) console.error(`[next-dev:err] ${s}`);
  });

  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    if (await isServerReady(port)) {
      console.log(`Next.js dev server ready on port ${port}`);
      return proc;
    }
  }
  if (proc.pid) {
    spawnSync("taskkill", ["/pid", String(proc.pid), "/t", "/f"], { stdio: "ignore" });
  }
  throw new Error(`Timed out waiting for Next.js dev server on port ${port}`);
}

async function createSessionToken(user, extraClaims = {}) {
  const jti = crypto.randomUUID();
  const jtiHash = crypto.createHash("sha256").update(jti).digest("hex");
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);

  const row = await prisma.userSession.create({
    data: {
      userId: user.id,
      jtiHash,
      expiresAt,
      ipAddress: "127.0.0.1",
      userAgent: "Stage2AuditRunner",
    },
  });

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || jwtSecret.length < 32) {
    throw new Error("JWT_SECRET must be configured (>= 32 chars)");
  }

  const token = jwt.sign(
    {
      userId: user.id,
      email: user.email,
      platformRole: user.platformRole,
      ...extraClaims,
    },
    jwtSecret,
    { expiresIn: "2h", jwtid: jti }
  );

  return { token, sessionId: row.id };
}

async function connectCDP(port) {
  let ok = false;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (res.ok) {
        ok = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 400));
  }
  if (!ok) throw new Error(`CDP endpoint on port ${port} unreachable`);

  const tabRes = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" });
  const target = await tabRes.json();
  const browserErrors = [];
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  let seq = 1;
  const pending = new Map();
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.method === "Runtime.exceptionThrown") {
      browserErrors.push(
        data.params?.exceptionDetails?.exception?.description ||
          data.params?.exceptionDetails?.text ||
          "Runtime exception"
      );
    } else if (data.method === "Log.entryAdded" && data.params?.entry?.level === "error") {
      browserErrors.push(`${data.params.entry.source}: ${data.params.entry.text}`);
    } else if (
      data.method === "Runtime.consoleAPICalled" &&
      data.params?.type === "error"
    ) {
      browserErrors.push(
        data.params.args?.map((a) => a.value || a.description || "").join(" ") || "console.error"
      );
    }
    if (data.id && pending.has(data.id)) {
      const { resolve, reject } = pending.get(data.id);
      pending.delete(data.id);
      if (data.error) reject(new Error(data.error.message));
      else resolve(data.result);
    }
  };

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = seq++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });

  return { ws, send, browserErrors };
}

async function setCookie(send, name, value, httpOnly = false) {
  await send("Network.setCookie", {
    name,
    value,
    domain: "127.0.0.1",
    path: "/",
    httpOnly,
    sameSite: "Lax",
  });
}

async function evalJS(send, expression) {
  const res = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (res.exceptionDetails) {
    throw new Error(
      `Browser JS error: ${res.exceptionDetails.text || JSON.stringify(res.exceptionDetails)}`
    );
  }
  return res.result?.value;
}

async function seedStage2Fixture() {
  const suffix = "ui2_" + Date.now();
  const fakeHash = "$2a$10$abcdefghijklmnopqrstuvABCDEFGHIJKLMNOPQRSTUVWXYZ012";

  const makeUser = (key, fullName, platformRole = "NONE") =>
    prisma.platformUser.create({
      data: {
        email: `${key}.${suffix}@edarschi.test`,
        fullName,
        passwordHash: fakeHash,
        platformRole,
        preferredLanguage: "ru",
        isActive: true,
        emailVerified: new Date(),
      },
    });

  const superadmin = await makeUser("superadmin", "Азиз Суперадмин", "SUPERADMIN");
  const platformAdmin = await makeUser("platadmin", "Фаррух Админ Платформы", "PLATFORM_ADMIN");
  const platformSupport = await makeUser("platsup", "Лола Саппорт Платформы", "PLATFORM_SUPPORT");
  const developer = await makeUser("dev", "Тимур Разработчик", "DEVELOPER");

  const director = await makeUser("director", "Камола Директор");
  const centerAdmin = await makeUser("cadmin", "Рустам Админ Центра");
  const accountant = await makeUser("acc", "Дильноза Бухгалтер");
  const teacher = await makeUser("teacher", "Сардор Преподаватель");
  const assistant = await makeUser("assist", "Мадина Ассистент");
  const centerSupport = await makeUser("csup", "Жасур Саппорт");
  const student1 = await makeUser("student1", "Алишер Ученик");
  const student2 = await makeUser("student2", "Нигора Ученица");
  const parent = await makeUser("parent", "Шахло Родитель");

  const plan = await prisma.subscriptionPlan.create({
    data: {
      name: `Pro UI2 ${suffix}`,
      priceMonthly: 600000,
      maxStudents: 500,
      maxTeachers: 50,
      maxCourses: 50,
      featuresJson: JSON.stringify({
        onlinePaymentsClick: true,
        telegramBot: true,
        smsReminders: true,
        broadcasts: true,
        advancedReports: true,
        mobileApp: true,
        pdfReceipts: true,
        promoCodes: true,
        financeAccounting: true,
      }),
    },
  });

  const center1 = await prisma.learningCenter.create({
    data: {
      name: "Bright Academy",
      slug: `bright-${suffix}`,
      status: "ACTIVE",
      ownerId: director.id,
    },
  });

  const center2 = await prisma.learningCenter.create({
    data: {
      name: "Second Campus",
      slug: `second-${suffix}`,
      status: "ACTIVE",
      ownerId: director.id,
    },
  });

  await prisma.subscription.create({
    data: {
      centerId: center1.id,
      planId: plan.id,
      status: "ACTIVE",
      currentPeriodEndsAt: new Date(Date.now() + 30 * 86400 * 1000),
    },
  });

  const makeMem = (userId, centerId, role) =>
    prisma.centerMembership.create({
      data: { userId, centerId, role, status: "ACTIVE" },
    });

  await makeMem(director.id, center1.id, "DIRECTOR");
  await makeMem(director.id, center2.id, "DIRECTOR"); // 2nd membership triggers WorkspaceSwitcher
  await makeMem(centerAdmin.id, center1.id, "CENTER_ADMIN");
  await makeMem(accountant.id, center1.id, "ACCOUNTANT");
  await makeMem(teacher.id, center1.id, "TEACHER");
  await makeMem(assistant.id, center1.id, "TEACHER_ASSISTANT");
  await makeMem(centerSupport.id, center1.id, "CENTER_SUPPORT");
  const stMem1 = await makeMem(student1.id, center1.id, "STUDENT");
  const stMem2 = await makeMem(student2.id, center1.id, "STUDENT");
  const parentMem = await makeMem(parent.id, center1.id, "PARENT");

  // Confirm 2 children for PARENT so header switcher appears
  await prisma.parentLink.createMany({
    data: [
      { parentMembershipId: parentMem.id, studentMembershipId: stMem1.id, status: "CONFIRMED" },
      { parentMembershipId: parentMem.id, studentMembershipId: stMem2.id, status: "CONFIRMED" },
    ],
  });

  return {
    center1,
    center2,
    plan,
    users: [
      superadmin,
      platformAdmin,
      platformSupport,
      developer,
      director,
      centerAdmin,
      accountant,
      teacher,
      assistant,
      centerSupport,
      student1,
      student2,
      parent,
    ],
    roles: [
      { key: "superadmin", user: superadmin, path: "/platform-admin" },
      { key: "platform-admin", user: platformAdmin, path: "/platform-admin" },
      { key: "platform-support", user: platformSupport, path: "/platform-admin" },
      { key: "developer", user: developer, path: "/developer" },
      { key: "director", user: director, path: "/center", centerId: center1.id, centerRole: "DIRECTOR" },
      { key: "center-admin", user: centerAdmin, path: "/center", centerId: center1.id, centerRole: "CENTER_ADMIN" },
      { key: "accountant", user: accountant, path: "/center", centerId: center1.id, centerRole: "ACCOUNTANT" },
      { key: "teacher", user: teacher, path: "/center", centerId: center1.id, centerRole: "TEACHER" },
      { key: "teacher-assistant", user: assistant, path: "/center", centerId: center1.id, centerRole: "TEACHER_ASSISTANT" },
      { key: "center-support", user: centerSupport, path: "/center", centerId: center1.id, centerRole: "CENTER_SUPPORT" },
      { key: "student", user: student1, path: "/center", centerId: center1.id, centerRole: "STUDENT" },
      { key: "parent", user: parent, path: "/center", centerId: center1.id, centerRole: "PARENT" },
      { key: "account-unified", user: director, path: "/account", centerId: center1.id, centerRole: "DIRECTOR" },
    ],
  };
}

async function cleanupFixture(fixture) {
  if (!fixture) return;
  const userIds = fixture.users.map((u) => u.id);
  const centerIds = [fixture.center1.id, fixture.center2.id];
  await prisma.parentLink.deleteMany({
    where: { OR: [{ parent: { centerId: { in: centerIds } } }, { student: { centerId: { in: centerIds } } }] },
  }).catch(() => {});
  await prisma.subscription.deleteMany({ where: { centerId: { in: centerIds } } }).catch(() => {});
  await prisma.centerMembership.deleteMany({ where: { centerId: { in: centerIds } } }).catch(() => {});
  await prisma.learningCenter.deleteMany({ where: { id: { in: centerIds } } }).catch(() => {});
  await prisma.subscriptionPlan.deleteMany({ where: { id: fixture.plan.id } }).catch(() => {});
  await prisma.userSession.deleteMany({ where: { userId: { in: userIds } } }).catch(() => {});
  await prisma.platformUser.deleteMany({ where: { id: { in: userIds } } }).catch(() => {});
}

async function main() {
  const outDir = path.join(process.cwd(), "docs", "ui", "stage-2");
  fs.mkdirSync(outDir, { recursive: true });
  const reportsDir = path.join(process.cwd(), "reports");
  fs.mkdirSync(reportsDir, { recursive: true });

  const axePath = path.join(process.cwd(), "node_modules", "axe-core", "axe.min.js");
  const axeSource = fs.readFileSync(axePath, "utf8");

  const port = 3012;
  const cdpPort = 9230;
  let fixture = null;
  let serverProc = null;
  let browserProc = null;
  let tmpProfile = null;

  try {
    fixture = await seedStage2Fixture();
    const roleTokens = new Map();
    for (const r of fixture.roles) {
      if (!roleTokens.has(`${r.key}:${r.user.id}`)) {
        const claims = r.centerId
          ? { activeCenterId: r.centerId, activeCenterRole: r.centerRole }
          : {};
        const { token } = await createSessionToken(r.user, claims);
        roleTokens.set(`${r.key}:${r.user.id}`, token);
      }
    }

    serverProc = await startDevServer(port);
    const browserPath = findBrowser();
    tmpProfile = fs.mkdtempSync(path.join(os.tmpdir(), "edarschi-ui2-"));
    browserProc = spawn(browserPath, [
      "--headless",
      "--disable-gpu",
      `--remote-debugging-port=${cdpPort}`,
      "--no-first-run",
      "--no-default-browser-check",
      `--user-data-dir=${tmpProfile}`,
      "about:blank",
    ]);

    const { ws, send, browserErrors } = await connectCDP(cdpPort);
    await send("Page.enable");
    await send("Network.enable");
    await send("Runtime.enable");
    await send("Log.enable");

    const themes = ["light", "dark"];
    const viewports = [
      { key: "1440", width: 1440, height: 900 },
      { key: "390", width: 390, height: 844 },
    ];

    const report = [];

    for (const r of fixture.roles) {
      const token = roleTokens.get(`${r.key}:${r.user.id}`);
      const url = `http://127.0.0.1:${port}${r.path}`;

      for (const theme of themes) {
        for (const vp of viewports) {
          const shotName = `${r.key}-${theme}-${vp.key}`;
          await setCookie(send, PANEL_THEME_COOKIE, theme, false);
          await setCookie(send, PANEL_RESOLVED_COOKIE, theme, false);
          await setCookie(send, "auth_token", token, true);

          await send("Emulation.setDeviceMetricsOverride", {
            width: vp.width,
            height: vp.height,
            deviceScaleFactor: 1,
            mobile: vp.width < 768,
          });

          browserErrors.length = 0;
          await send("Page.navigate", { url });
          for (let w = 0; w < 40; w++) {
            await new Promise((res) => setTimeout(res, 400));
            const ready = await evalJS(
              send,
              `document.readyState === "complete" && document.body && document.body.innerText.trim().length > 0 && location.pathname === "${r.path}"`
            ).catch(() => false);
            if (ready) break;
          }
          await new Promise((res) => setTimeout(res, 600));

          const metrics = await evalJS(
            send,
            `(() => {
              const navLinks = Array.from(document.querySelectorAll('aside nav a')).map(a => ({
                href: a.getAttribute('href'),
                text: (a.textContent || '').trim()
              }));
              const hasParentSwitcher = Boolean(document.querySelector('select[aria-label="Ребёнок"]'));
              const hasWorkspaceSwitcher = Boolean(document.querySelector('#edarschi-workspace-switcher'));
              const hasReadOnlyBanner = Boolean(document.querySelector('[role="status"]'));
              return {
                pathname: location.pathname,
                scrollWidth: document.documentElement.scrollWidth,
                innerWidth: window.innerWidth,
                hasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
                htmlDark: document.documentElement.classList.contains('dark'),
                navLinks,
                hasParentSwitcher,
                hasWorkspaceSwitcher,
                hasReadOnlyBanner,
              };
            })()`
          );

          await evalJS(send, axeSource);
          const axe = await evalJS(
            send,
            `(async () => {
              const r = await axe.run(document, {
                runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] }
              });
              return {
                violations: r.violations.map((v) => ({
                  id: v.id,
                  impact: v.impact,
                  nodesCount: v.nodes.length,
                  targets: v.nodes.slice(0, 5).map((n) => n.target.join(" ")),
                })),
                passesCount: r.passes.length,
              };
            })()`
          );

          const shot = await send("Page.captureScreenshot", { format: "png" });
          const filePath = path.join(outDir, `${shotName}.png`);
          fs.writeFileSync(filePath, Buffer.from(shot.data, "base64"));

          const relevantErrors = browserErrors.filter(
            (e) => !e.includes("favicon.ico") && !e.includes("404 (Not Found)")
          );

          report.push({
            name: shotName,
            role: r.key,
            theme,
            viewport: `${vp.width}x${vp.height}`,
            ...metrics,
            axeViolations: axe.violations.length,
            axeDetails: axe.violations,
            axePasses: axe.passesCount,
            browserErrors: relevantErrors,
          });

          console.log(
            `[${shotName}] path=${metrics.pathname} nav=${metrics.navLinks.length} overflow=${metrics.hasHorizontalOverflow} axe=${axe.violations.length} errs=${relevantErrors.length}`
          );
        }
      }
    }

    const reportPath = path.join(reportsDir, "stage2-audit.json");
    fs.writeFileSync(reportPath, JSON.stringify({ generatedAt: new Date().toISOString(), results: report }, null, 2));
    console.log(`Stage 2 screenshot & audit report saved to ${reportPath}`);
    ws.close();
  } finally {
    if (browserProc && browserProc.pid) {
      try {
        spawnSync("taskkill", ["/pid", String(browserProc.pid), "/t", "/f"], { stdio: "ignore" });
      } catch {}
    }
    if (tmpProfile) {
      try {
        fs.rmSync(tmpProfile, { recursive: true, force: true });
      } catch {}
    }
    if (serverProc && serverProc.pid) {
      try {
        spawnSync("taskkill", ["/pid", String(serverProc.pid), "/t", "/f"], { stdio: "ignore" });
      } catch {}
    }
    await cleanupFixture(fixture);
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Stage 2 screenshot runner failed:", err);
  process.exit(1);
});
