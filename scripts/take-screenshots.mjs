import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

// Load .env explicitly
if (fs.existsSync(".env")) {
  const envContent = fs.readFileSync(".env", "utf8");
  envContent.split("\n").forEach((line) => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const val = match[2].trim().replace(/^['"]|['"]$/g, "");
      if (!process.env[key]) process.env[key] = val;
    }
  });
}

const prisma = new PrismaClient();

// Detect browser executable
function findBrowser() {
  const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
  const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  if (fs.existsSync(edgePath)) return edgePath;
  if (fs.existsSync(chromePath)) return chromePath;
  throw new Error("Neither Edge nor Chrome browser found on system");
}

async function isServerRunning(port = 3000) {
  try {
    const res = await fetch(`http://localhost:${port}/api/health`, { method: "HEAD" }).catch(() => null);
    if (res && res.status < 500) return true;
    const resRoot = await fetch(`http://localhost:${port}`, { method: "HEAD" }).catch(() => null);
    return resRoot !== null;
  } catch {
    return false;
  }
}

async function ensureServer(port = 3000) {
  const running = await isServerRunning(port);
  if (running) {
    console.log(`Server already active on port ${port}`);
    return null;
  }

  console.log(`Starting Next.js server on port ${port}...`);
  const serverProc = spawn("cmd.exe", ["/c", "npx", "next", "start", "-p", String(port)], {
    stdio: "pipe",
    env: { ...process.env, PORT: String(port) },
  });

  // Wait for server to respond
  let attempts = 0;
  while (attempts < 30) {
    await new Promise((r) => setTimeout(r, 1000));
    if (await isServerRunning(port)) {
      console.log(`Server successfully started on port ${port}`);
      return serverProc;
    }
    attempts++;
  }

  serverProc.kill();
  throw new Error(`Timed out waiting for Next.js server on port ${port}`);
}

async function generateSuperadminToken() {
  const adminUser = await prisma.platformUser.findFirst({
    where: { platformRole: "SUPERADMIN" },
  });

  if (!adminUser) {
    throw new Error("No SUPERADMIN user found in database. Run prisma:seed first.");
  }

  const jti = crypto.randomUUID();
  const jtiHash = crypto.createHash("sha256").update(jti).digest("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.userSession.create({
    data: {
      userId: adminUser.id,
      jtiHash,
      expiresAt,
      ipAddress: "127.0.0.1",
      userAgent: "ScreenshotRunner",
    },
  });

  const jwtSecret = process.env.JWT_SECRET || "super-secret-jwt-key-for-aziz-lms-platform-2026";
  const token = jwt.sign(
    {
      userId: adminUser.id,
      email: adminUser.email,
      platformRole: "SUPERADMIN",
    },
    jwtSecret,
    { expiresIn: "7d", jwtid: jti }
  );

  return token;
}

// Simple CDP client using native Node.js WebSocket
async function connectCDP(port = 9222) {
  // Wait for browser debug endpoint
  let version = null;
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (res.ok) {
        version = await res.json();
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }

  if (!version) {
    throw new Error("Failed to connect to browser CDP endpoint");
  }

  // Create a new blank page/target
  const newTabRes = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" });
  const target = await newTabRes.json();
  const wsUrl = target.webSocketDebuggerUrl;

  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  let messageId = 1;
  const pending = new Map();

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.id && pending.has(data.id)) {
        const { resolve, reject } = pending.get(data.id);
        pending.delete(data.id);
        if (data.error) reject(new Error(data.error.message));
        else resolve(data.result);
      }
    } catch (e) {
      console.error("CDP Message Parse Error:", e);
    }
  };

  const send = (method, params = {}) => {
    return new Promise((resolve, reject) => {
      const id = messageId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  };

  return { ws, send, targetId: target.id };
}

async function main() {
  const screenshotsDir = path.join(process.cwd(), "reports", "screenshots");
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const port = 3000;
  const serverProc = await ensureServer(port);

  console.log("Generating authentication token for SUPERADMIN...");
  const token = await generateSuperadminToken();

  const browserPath = findBrowser();
  const tmpProfile = fs.mkdtempSync(path.join(os.tmpdir(), "browser-profile-"));
  const cdpPort = 9222;

  console.log(`Launching browser: ${browserPath}...`);
  const browserProc = spawn(browserPath, [
    "--headless",
    "--disable-gpu",
    `--remote-debugging-port=${cdpPort}`,
    "--no-first-run",
    "--no-default-browser-check",
    `--user-data-dir=${tmpProfile}`,
    "about:blank",
  ]);

  try {
    console.log("Connecting to Chrome DevTools Protocol...");
    const { send, ws } = await connectCDP(cdpPort);

    await send("Page.enable");
    await send("Network.enable");

    // Set auth cookie
    await send("Network.setCookie", {
      name: "auth_token",
      value: token,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    });

    // Get first center for center-card screenshot
    const firstCenter = await prisma.learningCenter.findFirst({
      select: { id: true, name: true },
    });
    const centerCardUrl = firstCenter
      ? `http://localhost:${port}/platform-admin/centers/${firstCenter.id}`
      : `http://localhost:${port}/platform-admin/centers`;

    const pagesToCapture = [
      {
        name: "01_platform_dashboard_desktop",
        url: `http://localhost:${port}/platform-admin`,
        viewport: { width: 1280, height: 800 },
        desc: "Platform Owner Dashboard (Desktop light theme)",
      },
      {
        name: "02_platform_dashboard_mobile",
        url: `http://localhost:${port}/platform-admin`,
        viewport: { width: 375, height: 812 },
        desc: "Platform Owner Dashboard (Mobile 375px responsive drawer header)",
      },
      {
        name: "03_platform_centers_list",
        url: `http://localhost:${port}/platform-admin/centers`,
        viewport: { width: 1280, height: 800 },
        desc: "Centers Management List with search & filters",
      },
      {
        name: "04_platform_center_card",
        url: centerCardUrl,
        viewport: { width: 1280, height: 800 },
        desc: "Center Card with details, status controls & audit logs",
      },
      {
        name: "05_platform_plans",
        url: `http://localhost:${port}/platform-admin/plans`,
        viewport: { width: 1280, height: 800 },
        desc: "SaaS Plans Management & Limits",
      },
      {
        name: "06_platform_subscriptions",
        url: `http://localhost:${port}/platform-admin/subscriptions`,
        viewport: { width: 1280, height: 800 },
        desc: "Centers Subscriptions & Billing Status",
      },
      {
        name: "07_platform_support",
        url: `http://localhost:${port}/platform-admin/support`,
        viewport: { width: 1280, height: 800 },
        desc: "Platform Support Tickets Management",
      },
      {
        name: "08_platform_audit_log",
        url: `http://localhost:${port}/platform-admin/audit`,
        viewport: { width: 1280, height: 800 },
        desc: "System Global Audit Log (SUPERADMIN)",
      },
      {
        name: "09_landing_page_desktop",
        url: `http://localhost:${port}/ru`,
        viewport: { width: 1280, height: 900 },
        desc: "Landing Page Desktop (strict font, photo preview, mesh gradients, particles)",
      },
      {
        name: "10_landing_page_mobile",
        url: `http://localhost:${port}/ru`,
        viewport: { width: 375, height: 812 },
        desc: "Landing Page Mobile (responsive hero, strict typography, clean cards)",
      },
      {
        name: "11_login_page",
        url: `http://localhost:${port}/login`,
        viewport: { width: 1280, height: 800 },
        desc: "Client Login Page (light theme, strict font, password toggle, brand e-darischi)",
      },
      {
        name: "12_register_page",
        url: `http://localhost:${port}/register`,
        viewport: { width: 1280, height: 850 },
        desc: "Client Registration Page (invite code, password strength meter, strict font)",
      },
    ];

    console.log("\n📸 Capturing screenshots:");
    for (const page of pagesToCapture) {
      console.log(`- Capturing ${page.name} (${page.desc})...`);

      await send("Emulation.setDeviceMetricsOverride", {
        width: page.viewport.width,
        height: page.viewport.height,
        deviceScaleFactor: 1,
        mobile: page.viewport.width < 768,
      });

      await send("Page.navigate", { url: page.url });
      // Allow layout, fonts, and icons to render smoothly
      await new Promise((r) => setTimeout(r, 2000));

      const screenshot = await send("Page.captureScreenshot", { format: "png" });
      const outputPath = path.join(screenshotsDir, `${page.name}.png`);
      fs.writeFileSync(outputPath, Buffer.from(screenshot.data, "base64"));
      console.log(`  ✓ Saved to: ${outputPath} (${screenshot.data.length} bytes)`);
    }

    ws.close();
    console.log("\n🎉 All 8 platform panel screenshots captured successfully!");
  } finally {
    browserProc.kill();
    try {
      fs.rmSync(tmpProfile, { recursive: true, force: true });
    } catch {}

    if (serverProc && serverProc.pid) {
      console.log("Shutting down screenshot server process...");
      try {
        spawn("taskkill", ["/pid", String(serverProc.pid), "/t", "/f"]);
      } catch {}
    }
    await prisma.$disconnect();
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Screenshot capture failed:", err);
  process.exit(1);
});
