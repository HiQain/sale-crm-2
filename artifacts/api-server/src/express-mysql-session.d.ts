declare module "express-mysql-session" {
  import type session from "express-session";

  type SessionConstructor = typeof session;

  interface SessionStoreOptions {
    createDatabaseTable?: boolean;
    schema?: {
      tableName?: string;
      columnNames?: {
        session_id?: string;
        expires?: string;
        data?: string;
      };
    };
  }

  interface SessionStore extends session.Store {
    close(): void | Promise<void>;
  }

  export default function MySQLStoreFactory(
    sessionConstructor: SessionConstructor,
  ): new (options?: SessionStoreOptions, connection?: unknown) => SessionStore;
}
