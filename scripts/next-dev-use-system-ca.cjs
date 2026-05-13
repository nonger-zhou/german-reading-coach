/**
 * 以 `node [--use-system-ca] …/next dist/bin/next dev` 启动开发服务器。
 * 减轻 Windows + HTTPS 代理 / 企业根证书 场景下 `unable to verify the first certificate`。
 * 需 Node 20.19+、22.9+ 等支持 `--use-system-ca` 的版本；过低版本仅回退为普通 next dev。
 */
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

const root = path.join(__dirname, "..");
const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");

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

function nodeOptionsAlreadyHasUseSystemCa() {
  const opts = process.env.NODE_OPTIONS ?? "";
  return /\B--use-system-ca\b/.test(opts);
}

if (!fs.existsSync(nextBin)) {
  console.error("[dev] 未找到 Next 可执行文件:", nextBin);
  process.exit(1);
}

const useSystemCa = nodeSupportsUseSystemCa() && !nodeOptionsAlreadyHasUseSystemCa();
const execArgv = useSystemCa ? ["--use-system-ca", nextBin, "dev"] : [nextBin, "dev"];

if (useSystemCa) {
  process.stderr.write(
    "[dev] 已启用 Node --use-system-ca（使用系统证书库），可减轻代理/企业证书导致的 TLS 校验失败。\n",
  );
} else if (!nodeSupportsUseSystemCa()) {
  process.stderr.write(
    `[dev] 当前 Node ${process.version} 不支持 --use-system-ca；若遇证书错误请升级到 Node 20.19+ 或 22.9+，或见 .env.example / 检查清单。\n`,
  );
}

const child = spawn(process.execPath, execArgv, {
  stdio: "inherit",
  cwd: root,
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
