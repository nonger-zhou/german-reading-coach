/**
 * 以带系统 CA 的方式调用 `npx vercel --prod`，减轻 Windows 下
 * `unable to verify the first certificate`（代理 / 企业根证书）导致的 CLI 失败。
 * 需 Node 20.19+、22.9+ 等支持 `--use-system-ca`；过低版本仍执行 vercel，仅打印提示。
 */
const path = require("node:path");
const { spawn } = require("node:child_process");

const root = path.join(__dirname, "..");

function nodeSupportsUseSystemCa() {
  const parts = process.versions.node.split(".").map(Number);
  const major = parts[0];
  const minor = parts[1] ?? 0;
  if (Number.isNaN(major)) return false;
  if (major > 22) return true;
  if (major === 22 && minor >= 9) return true;
  if (major === 20 && minor >= 19) return true;
  return false;
}

function nodeOptionsAlreadyHasUseSystemCa(opts) {
  return /\B--use-system-ca\b/.test(opts ?? "");
}

const baseOpts = process.env.NODE_OPTIONS ?? "";
const useSystemCa = nodeSupportsUseSystemCa() && !nodeOptionsAlreadyHasUseSystemCa(baseOpts);
const env = { ...process.env };
if (useSystemCa) {
  env.NODE_OPTIONS = `${baseOpts} --use-system-ca`.trim();
  process.stderr.write(
    "[vercel:prod] 已为子进程设置 NODE_OPTIONS=--use-system-ca（使用系统证书库）。\n",
  );
} else if (!nodeSupportsUseSystemCa()) {
  process.stderr.write(
    `[vercel:prod] 当前 Node ${process.version} 不支持 --use-system-ca；若仍报证书错误请升级 Node 或改用 Git / Dashboard 部署。\n`,
  );
}

const shell = process.platform === "win32";
const child = spawn("npx", ["vercel", "--prod"], {
  stdio: "inherit",
  cwd: root,
  env,
  shell,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
