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

const prisma = new PrismaClient();
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
    const res = await fetch(`http://127.0.0.1:${port}/dev/ui-kit`, {
      signal: AbortSignal.timeout(10000),
    });
    if (res.status >= 500) {
      const txt = await res.text().catch(() => "");
      console.error(`Server returned ${res.status} on /dev/ui-kit:`, txt.slice(0, 500));
    }
    return res.status === 200;
  } catch {
    return false;
  }
}

async function startDevServer(port) {
  if (await isServerReady(port)) {
    console.log(`Using active server on port ${port}`);
    return null;
  }
  console.log(`Starting Next.js dev server on port ${port}...`);
  const proc = spawn("cmd.exe", ["/c", "npx", "next", "dev", "-H", "127.0.0.1", "-p", String(port)], {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, PORT: String(port), NODE_ENV: "development" },
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
      userAgent: "Stage1AuditRunner",
    },
  });

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || jwtSecret.length < 32) {
    throw new Error("JWT_SECRET must be configured (>= 32 chars) in .env");
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

async function main() {
  const outDir = path.join(process.cwd(), "docs", "ui", "stage-1");
  fs.mkdirSync(outDir, { recursive: true });
  const reportsDir = path.join(process.cwd(), "reports");
  fs.mkdirSync(reportsDir, { recursive: true });

  const axePath = path.join(process.cwd(), "node_modules", "axe-core", "axe.min.js");
  if (!fs.existsSync(axePath)) {
    throw new Error("axe-core not installed in node_modules/axe-core/axe.min.js");
  }
  const axeSource = fs.readFileSync(axePath, "utf8");

  const port = 3011;
  const cdpPort = 9229;
  const serverProc = await startDevServer(port);
  const createdSessionIds = [];
  let browserProc = null;
  let tmpProfile = null;

  try {
    let adminToken = "";
    let centerToken = "";

    const superadmin = await prisma.platformUser.findFirst({
      where: { platformRole: "SUPERADMIN", deletedAt: null },
    });
    if (superadmin) {
      const res = await createSessionToken(superadmin);
      adminToken = res.token;
      createdSessionIds.push(res.sessionId);
    }

    const membership = await prisma.centerMembership.findFirst({
      where: { status: "ACTIVE", role: { in: ["DIRECTOR", "CENTER_ADMIN"] } },
      include: { user: true },
    });
    if (membership) {
      const res = await createSessionToken(membership.user, {
        activeCenterId: membership.centerId,
        activeCenterRole: membership.role,
      });
      centerToken = res.token;
      createdSessionIds.push(res.sessionId);
    }

    const browserPath = findBrowser();
    tmpProfile = fs.mkdtempSync(path.join(os.tmpdir(), "edarschi-ui1-"));
    browserProc = spawn(browserPath, [
      "--headless",
      "--disable-gpu",
      `--remote-debugging-port=${cdpPort}`,
      "--no-first-run",
      "--no-default-browser-check",
      `--user-data-dir=${tmpProfile}`,
      "about:blank",
    ]);

    const auditResults = [];
    const { ws, send, browserErrors } = await connectCDP(cdpPort);
    await send("Page.enable");
    await send("Network.enable");
    await send("Runtime.enable");
    await send("Log.enable");

    const targets = [
      {
        name: "ui-kit-light-1440",
        url: `http://127.0.0.1:${port}/dev/ui-kit`,
        width: 1440,
        height: 900,
        theme: "light",
        fullPage: true,
        auth: null,
      },
      {
        name: "ui-kit-dark-1440",
        url: `http://127.0.0.1:${port}/dev/ui-kit?theme=dark`,
        width: 1440,
        height: 900,
        theme: "dark",
        fullPage: true,
        auth: null,
      },
      {
        name: "ui-kit-light-390",
        url: `http://127.0.0.1:${port}/dev/ui-kit`,
        width: 390,
        height: 844,
        theme: "light",
        fullPage: false,
        auth: null,
      },
      {
        name: "ui-kit-dark-390",
        url: `http://127.0.0.1:${port}/dev/ui-kit?theme=dark`,
        width: 390,
        height: 844,
        theme: "dark",
        fullPage: false,
        auth: null,
      },
      ...(centerToken
        ? [
            {
              name: "center-shell-light-1440",
              url: `http://127.0.0.1:${port}/center`,
              width: 1440,
              height: 900,
              theme: "light",
              fullPage: false,
              auth: centerToken,
            },
            {
              name: "center-shell-dark-1440",
              url: `http://127.0.0.1:${port}/center`,
              width: 1440,
              height: 900,
              theme: "dark",
              fullPage: false,
              auth: centerToken,
            },
          ]
        : []),
      ...(adminToken
        ? [
            {
              name: "platform-shell-light-1440",
              url: `http://127.0.0.1:${port}/platform-admin`,
              width: 1440,
              height: 900,
              theme: "light",
              fullPage: false,
              auth: adminToken,
            },
            {
              name: "platform-shell-dark-1440",
              url: `http://127.0.0.1:${port}/platform-admin`,
              width: 1440,
              height: 900,
              theme: "dark",
              fullPage: false,
              auth: adminToken,
            },
          ]
        : []),
    ];

    for (const target of targets) {
      console.log(`Capturing ${target.name} (${target.url})...`);
      await setCookie(send, PANEL_THEME_COOKIE, target.theme, false);
      await setCookie(send, PANEL_RESOLVED_COOKIE, target.theme, false);
      if (target.auth) {
        await setCookie(send, "auth_token", target.auth, true);
      }

      await send("Emulation.setDeviceMetricsOverride", {
        width: target.width,
        height: target.height,
        deviceScaleFactor: 1,
        mobile: target.width < 768,
      });

      browserErrors.length = 0;
      await send("Page.navigate", { url: target.url });
      // Wait for SSR + on-demand Next.js dev compilation to complete
      for (let w = 0; w < 40; w++) {
        await new Promise((r) => setTimeout(r, 500));
        const ready = await evalJS(
          send,
          `document.readyState === "complete" && document.body && document.body.innerText.trim().length > 0`
        ).catch(() => false);
        if (ready) break;
      }
      // Wait for dynamic Recharts chunks to mount SVGs on /dev/ui-kit
      if (target.url.includes("/dev/ui-kit")) {
        for (let c = 0; c < 30; c++) {
          const chartCount = await evalJS(
            send,
            `document.querySelectorAll('.recharts-surface').length`
          ).catch(() => 0);
          if (chartCount >= 4) break;
          await new Promise((r) => setTimeout(r, 500));
        }
      }
      await new Promise((r) => setTimeout(r, 1200));

      const pageMetrics = await evalJS(
        send,
        `(async () => {
          await document.fonts.ready;
          const loaded = Array.from(document.fonts)
            .filter((f) => f.status === 'loaded')
            .map((f) => f.family);
          return {
            title: document.title,
            url: location.href,
            loadedFonts: Array.from(new Set(loaded)),
            scrollWidth: document.documentElement.scrollWidth,
            innerWidth: window.innerWidth,
            scrollHeight: document.documentElement.scrollHeight,
            hasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
            htmlDark: document.documentElement.classList.contains('dark'),
            rechartsCount: document.querySelectorAll('.recharts-surface').length,
          };
        })()`
      );

      // Inject and run axe-core
      await evalJS(send, axeSource);
      const axeReport = await evalJS(
        send,
        `(async () => {
          const r = await axe.run(document, {
            runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] }
          });
          return {
            violations: r.violations.map((v) => ({
              id: v.id,
              impact: v.impact,
              description: v.description,
              helpUrl: v.helpUrl,
              nodesCount: v.nodes.length,
              sampleTargets: v.nodes.slice(0, 3).map((n) => n.target.join(' '))
            })),
            passesCount: r.passes.length,
            incompleteCount: r.incomplete.length
          };
        })()`
      );

      const screenshotParams = { format: "png" };
      if (target.fullPage) {
        const fullHeight = Math.min(Number(pageMetrics.scrollHeight) || target.height, 4500);
        screenshotParams.captureBeyondViewport = true;
        screenshotParams.clip = {
          x: 0,
          y: 0,
          width: target.width,
          height: fullHeight,
          scale: 1,
        };
      }

      const shot = await send("Page.captureScreenshot", screenshotParams);
      const filePath = path.join(outDir, `${target.name}.png`);
      fs.writeFileSync(filePath, Buffer.from(shot.data, "base64"));

      auditResults.push({
        name: target.name,
        url: target.url,
        theme: target.theme,
        viewport: `${target.width}x${target.height}`,
        screenshot: `docs/ui/stage-1/${target.name}.png`,
        browserErrors: [...browserErrors],
        ...pageMetrics,
        axe: axeReport,
      });

      const critOrSerious = axeReport.violations.filter(
        (v) => v.impact === "critical" || v.impact === "serious"
      );
      console.log(
        `  saved ${filePath} | fonts=${pageMetrics.loadedFonts.join(",")} | charts=${pageMetrics.rechartsCount} | overflow=${pageMetrics.hasHorizontalOverflow} (innerW=${pageMetrics.innerWidth}) | errors=${browserErrors.length} | axe=${axeReport.violations.length} (${critOrSerious.length} crit/serious)`
      );
      if (browserErrors.length > 0) {
        console.log(`  browserErrors:`, browserErrors.slice(0, 5));
      }
    }

    const reportPath = path.join(reportsDir, "axe-ui-kit.json");
    fs.writeFileSync(reportPath, JSON.stringify({ generatedAt: new Date().toISOString(), results: auditResults }, null, 2));
    console.log(`Axe & screenshot report saved to ${reportPath}`);
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
    if (createdSessionIds.length > 0) {
      await prisma.userSession.deleteMany({
        where: { id: { in: createdSessionIds } },
      }).catch(() => {});
    }
    if (serverProc && serverProc.pid) {
      try {
        spawnSync("taskkill", ["/pid", String(serverProc.pid), "/t", "/f"], { stdio: "ignore" });
      } catch {}
    }
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Stage 1 screenshot/axe runner failed:", err);
  process.exit(1);
});
