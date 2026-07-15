import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const isWindows = process.platform === "win32";

process.loadEnvFile(path.join(rootDir, ".env"));

const sharedEnv = {
  ...process.env,
  NODE_ENV: process.env.NODE_ENV ?? "development",
  DATABASE_URL:
    process.env.DATABASE_URL ??
    "mysql://root:@127.0.0.1:3306/nexuscrm",
  SESSION_SECRET:
    process.env.SESSION_SECRET ?? "crm-dev-secret-do-not-use-in-production",
};

const services = [
  {
    name: "api",
    color: "\u001b[36m",
    cwd: path.join(rootDir, "artifacts", "api-server"),
    env: {
      ...sharedEnv,
      PORT: process.env.API_PORT ?? process.env.PORT_API ?? "8080",
    },
    args: ["run", "dev"],
  },
  {
    name: "crm",
    color: "\u001b[35m",
    cwd: path.join(rootDir, "artifacts", "crm"),
    env: {
      ...sharedEnv,
      PORT: process.env.CRM_PORT ?? process.env.PORT_CRM ?? "3000",
      BASE_PATH: process.env.BASE_PATH ?? "/",
    },
    args: ["run", "dev"],
  },
];

const reset = "\u001b[0m";
const children = new Map();
let shuttingDown = false;

function prefixOutput(label, color, chunk) {
  const text = chunk.toString();
  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    if (!line) continue;
    process.stdout.write(`${color}[${label}]${reset} ${line}\n`);
  }
}

function terminateChildren(signal = "SIGTERM") {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children.values()) {
    if (!child.killed) {
      child.kill(signal);
    }
  }
}

console.log("Starting local CRM dev environment...");
console.log(
  `API: http://localhost:${services[0].env.PORT} | CRM: http://localhost:${services[1].env.PORT}`,
);
console.log(`DATABASE_URL: ${sharedEnv.DATABASE_URL}`);

for (const service of services) {
  const command = isWindows ? "cmd.exe" : "npm";
  const args = isWindows
    ? ["/d", "/s", "/c", `npm.cmd ${service.args.join(" ")}`]
    : service.args;

  const child = spawn(command, args, {
    cwd: service.cwd,
    env: service.env,
    stdio: ["inherit", "pipe", "pipe"],
  });

  children.set(service.name, child);

  child.stdout.on("data", (chunk) => {
    prefixOutput(service.name, service.color, chunk);
  });

  child.stderr.on("data", (chunk) => {
    prefixOutput(service.name, service.color, chunk);
  });

  child.on("exit", (code, signal) => {
    const details = signal ? `signal ${signal}` : `code ${code ?? 0}`;
    process.stdout.write(
      `${service.color}[${service.name}]${reset} exited with ${details}\n`,
    );

    if (!shuttingDown) {
      terminateChildren();
      process.exitCode = code ?? 1;
    }
  });

  child.on("error", (error) => {
    process.stderr.write(
      `${service.color}[${service.name}]${reset} failed to start: ${error.message}\n`,
    );
    terminateChildren();
    process.exitCode = 1;
  });
}

process.on("SIGINT", () => {
  terminateChildren("SIGINT");
});

process.on("SIGTERM", () => {
  terminateChildren("SIGTERM");
});
