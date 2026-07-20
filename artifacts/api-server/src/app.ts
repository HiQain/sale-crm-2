import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import path from "node:path";
import { existsSync } from "node:fs";
import { pool } from "@workspace/db";
import MySQLStoreFactory from "express-mysql-session";
import router from "./routes";
import { logger } from "./lib/logger";

const MySQLStore = MySQLStoreFactory(session);

function getSessionStoreOptions() {
  const databaseUrl = process.env["DATABASE_URL"];
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  const parsed = new URL(databaseUrl);

  if (parsed.protocol !== "mysql:") {
    throw new Error(`Unsupported DATABASE_URL protocol: ${parsed.protocol}`);
  }

  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 3306,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace(/^\//, ""),
  };
}

async function ensureSessionTable(): Promise<void> {
  const connection = await pool.getConnection();
  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        session_id varchar(128) NOT NULL,
        expires int unsigned NOT NULL,
        data mediumtext,
        PRIMARY KEY (session_id)
      )
    `);
    await connection.query(
      `CREATE INDEX idx_user_sessions_expires ON user_sessions (expires)`
    ).catch((error: unknown) => {
      const err = error as { code?: string };
      if (err.code !== "ER_DUP_KEYNAME") {
        throw error;
      }
    });
  } finally {
    connection.release();
  }
}

const app: Express = express();
const publicDir = path.resolve(globalThis.__dirname ?? process.cwd(), "public");
const hasBuiltFrontend = existsSync(path.join(publicDir, "index.html"));

// Trust the first proxy (Replit's reverse proxy) so cookies and
// secure flags work correctly in the proxied environment.
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const sessionSecret = process.env["SESSION_SECRET"];
if (!sessionSecret && process.env["NODE_ENV"] === "production") {
  throw new Error("SESSION_SECRET environment variable is required in production");
}
const resolvedSecret = sessionSecret ?? "crm-dev-secret-do-not-use-in-production";

app.use(
  session({
    store: new MySQLStore({
      ...getSessionStoreOptions(),
      createDatabaseTable: false,
      schema: {
        tableName: "user_sessions",
        columnNames: {
          session_id: "session_id",
          expires: "expires",
          data: "data",
        },
      },
    }),
    secret: resolvedSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // handled by Replit's TLS termination proxy
      httpOnly: true,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  }),
);

app.use("/api", router);

if (hasBuiltFrontend) {
  app.use(express.static(publicDir));

  app.get("/{*splat}", (req, res, next) => {
    if (req.path.startsWith("/api")) {
      next();
      return;
    }

    res.sendFile(path.join(publicDir, "index.html"));
  });
}

export { ensureSessionTable };
export default app;
