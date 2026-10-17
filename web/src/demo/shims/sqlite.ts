/**
 * node:sqlite's DatabaseSync API on top of sql.js (SQLite compiled to JavaScript),
 * so the server's own data layer runs unchanged in the demo build.
 */
// @ts-ignore - no types shipped for the asm.js build
import initSqlJs from 'sql.js/dist/sql-asm-memory-growth.js';

let SQL: any;
export const ready = (async () => { SQL = await initSqlJs(); })();

type Param = string | number | null | undefined | boolean;
const norm = (ps: Param[]) => ps.map((p) => (p === undefined ? null : typeof p === 'boolean' ? Number(p) : p));

export class DatabaseSync {
  private db: any;
  private cache = new Map<string, any>();
  constructor(_file?: string) {
    if (!SQL) throw new Error('sql.js not ready');
    this.db = new SQL.Database();
  }
  exec(sql: string) { this.db.exec(sql); }
  private stmt(sql: string) {
    let s = this.cache.get(sql);
    if (!s) this.cache.set(sql, (s = this.db.prepare(sql)));
    return s;
  }
  prepare(sql: string) {
    const self = this;
    return {
      get(...ps: Param[]) {
        const s = self.stmt(sql);
        try { s.bind(norm(ps)); return s.step() ? s.getAsObject() : undefined; } finally { s.reset(); }
      },
      all(...ps: Param[]) {
        const s = self.stmt(sql);
        const rows: any[] = [];
        try { s.bind(norm(ps)); while (s.step()) rows.push(s.getAsObject()); } finally { s.reset(); }
        return rows;
      },
      run(...ps: Param[]) {
        const s = self.stmt(sql);
        try { s.bind(norm(ps)); s.step(); } finally { s.reset(); }
        const changes = self.db.getRowsModified();
        const id = self.stmt('SELECT last_insert_rowid() AS id');
        try { id.step(); return { changes, lastInsertRowid: id.getAsObject().id }; } finally { id.reset(); }
      },
    };
  }
}
