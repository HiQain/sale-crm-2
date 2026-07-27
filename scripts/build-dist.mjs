import path from "node:path";
import { fileURLToPath } from "node:url";
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(rootDir, "dist");
const apiDir = path.join(rootDir, "artifacts", "api-server");
const crmDir = path.join(rootDir, "artifacts", "crm");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

function run(command, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, {
      cwd: rootDir,
      stdio: "inherit",
      shell: true,
      ...options,
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} failed with exit code ${code ?? -1}`));
    });
  });
}

async function buildDeployDist() {
  await rm(outputDir, { recursive: true, force: true });

  await run(`${npmCommand} run typecheck --workspace=@workspace/api-server`);
  await run(`${npmCommand} run typecheck --workspace=@workspace/crm`);

  await run(`${npmCommand} run build --workspace=@workspace/api-server`);

  await run(`${npmCommand} run build --workspace=@workspace/crm`, {
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: process.env.CRM_PORT ?? process.env.PORT ?? "3000",
      BASE_PATH: process.env.BASE_PATH ?? "/",
    },
  });

  await mkdir(outputDir, { recursive: true });

  await cp(path.join(apiDir, "dist"), outputDir, { recursive: true });
  await cp(path.join(crmDir, "dist", "public"), path.join(outputDir, "public"), { recursive: true });

  const deployPackageJson = {
    name: "nexuscrm-deploy",
    private: true,
    type: "module",
    scripts: {
      start: "node --enable-source-maps ./index.mjs",
    },
    dependencies: {
      bcryptjs: "^3.0.3",
      "cookie-parser": "^1.4.7",
      cors: "^2.8.6",
      "drizzle-orm": "^0.45.2",
      express: "^5.2.1",
      "express-mysql-session": "^3.0.3",
      "express-session": "^1.19.0",
      mysql2: "^3.15.1",
      pino: "^9.14.0",
      "pino-http": "^10.5.0",
    },
  };

  await writeFile(
    path.join(outputDir, "package.json"),
    `${JSON.stringify(deployPackageJson, null, 2)}\n`,
    "utf8",
  );
}

buildDeployDist().catch((error) => {
  console.error(error);
  process.exit(1);
});
