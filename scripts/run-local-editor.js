const { spawn } = require("child_process");
const path = require("path");

const workspaceRoot = path.resolve(__dirname, "..");
const serverScript = path.join(__dirname, "static-server.js");
const serverHost = process.env.EDITOR_HOST || "127.0.0.1";
const serverPort = process.env.EDITOR_PORT || "4173";
const launchUrl = process.env.EDITOR_ENTRY_URL || `http://${serverHost}:${serverPort}/`;
const autoOpenEnabled = process.env.EDITOR_NO_OPEN !== "1";

function openBrowser(url) {
  const platform = process.platform;
  if (platform === "win32") {
    return spawn("cmd", ["/c", "start", "", url], {
      detached: true,
      shell: false,
      stdio: "ignore",
    });
  }
  if (platform === "darwin") {
    return spawn("open", [url], {
      detached: true,
      stdio: "ignore",
    });
  }
  return spawn("xdg-open", [url], {
    detached: true,
    stdio: "ignore",
  });
}

const server = spawn(
  process.execPath,
  [serverScript, workspaceRoot, serverPort, serverHost],
  {
    cwd: workspaceRoot,
    stdio: ["inherit", "pipe", "pipe"],
  },
);

let opened = false;

function tryOpenBrowser() {
  if (opened) return;
  opened = true;
  if (!autoOpenEnabled) {
    console.log(`local launchpad available at ${launchUrl}`);
    return;
  }
  try {
    const opener = openBrowser(launchUrl);
    opener.unref();
    console.log(`opened ${launchUrl}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`could not open browser automatically: ${message}`);
    console.warn(`open this URL manually: ${launchUrl}`);
  }
}

server.stdout.on("data", (chunk) => {
  const text = chunk.toString();
  process.stdout.write(text);
  if (text.includes("static-server listening on")) {
    tryOpenBrowser();
  }
});

server.stderr.on("data", (chunk) => {
  process.stderr.write(chunk.toString());
});

server.on("exit", (code, signal) => {
  if (signal) {
    process.exitCode = 1;
    return;
  }
  process.exitCode = code || 0;
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (!server.killed) {
      server.kill(signal);
    }
  });
}
