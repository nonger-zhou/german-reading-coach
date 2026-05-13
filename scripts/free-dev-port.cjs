/**
 * 启动开发服务器前释放本机 3000 端口，避免多个 next dev 同时运行
 * （用户若仍打开 localhost:3000 会看到旧进程，与 localhost:3001 不一致）。
 * 纯 Node + 系统命令，不增加 npm 依赖。
 */
const { execSync } = require("node:child_process");

function killWindowsPid(pid) {
  try {
    execSync(`taskkill /F /PID ${pid}`, { stdio: "ignore" });
    process.stdout.write(`[dev] 已结束占用 3000 端口的进程 PID ${pid}。\n`);
  } catch {
    /* 进程已退出或无权限 */
  }
}

function freePort3000Windows() {
  let out;
  try {
    out = execSync("netstat -ano", { encoding: "utf8" });
  } catch {
    return;
  }
  const listenPids = new Set();
  for (const line of out.split(/\r?\n/)) {
    if (!line.includes(":3000")) continue;
    if (!/\bLISTENING\b/i.test(line)) continue;
    const parts = line.trim().split(/\s+/);
    const pid = parts[parts.length - 1];
    if (/^\d+$/.test(pid)) listenPids.add(pid);
  }
  for (const pid of listenPids) killWindowsPid(pid);
}

function freePort3000Unix() {
  let out;
  try {
    out = execSync("lsof -ti:3000", { encoding: "utf8" });
  } catch {
    return;
  }
  const pids = out
    .trim()
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const pid of pids) {
    try {
      execSync(`kill -9 ${pid}`, { stdio: "ignore" });
      process.stdout.write(`[dev] 已结束占用 3000 端口的进程 PID ${pid}。\n`);
    } catch {
      /* ignore */
    }
  }
}

if (process.platform === "win32") {
  freePort3000Windows();
} else {
  freePort3000Unix();
}
