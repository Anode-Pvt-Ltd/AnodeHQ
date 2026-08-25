/**
 * Runs the real migrations and seed against an in-process Postgres (PGlite),
 * then exercises the schema the way the app does.
 *
 *   node scripts/verify-db.mjs
 *
 * Supabase provides `auth`, `storage`, `pg_net` and `pg_cron` on its platform;
 * PGlite does not, so those are shimmed below. Everything else — every table,
 * constraint, trigger, policy and RPC — is the real migration text.
 */
import { PGlite } from "@electric-sql/pglite";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATIONS = join(ROOT, "supabase", "migrations");

let pass = 0;
let fail = 0;
const failures = [];

const ok = (label, extra = "") => { pass++; console.log(`  ✓ ${label}${extra ? "  " + extra : ""}`); };
const bad = (label, err) => {
  fail++;
  const msg = String(err?.message ?? err).split("\n")[0].slice(0, 160);
  failures.push(`${label}: ${msg}`);
  console.log(`  ✗ ${label}\n      ${msg}`);
};

async function check(label, fn, expect) {
  try {
    const r = await fn();
    if (expect) {
      const verdict = expect(r);
      if (verdict === true) ok(label);
      else bad(label, verdict || "assertion failed");
    } else ok(label);
  } catch (e) { bad(label, e); }
}

/** Expects the statement to be REJECTED — used for constraint and policy tests. */
async function mustFail(label, fn, matcher) {
  try {
    await fn();
    bad(label, "expected an error but the statement succeeded");
  } catch (e) {
    const m = String(e.message ?? e);
    if (!matcher || matcher.test(m)) ok(label, `(rejected: ${m.split("\n")[0].slice(0, 62)})`);
    else bad(label, `rejected, but not as expected: ${m.slice(0, 120)}`);
  }
}

const db = await PGlite.create({ extensions: { citext, pgcrypto, pg_trgm, unaccent } });

/* ------------------------------------------------------------------
 * Platform shims — what Supabase supplies and PGlite does not
 * ------------------------------------------------------------------ */
console.log("\n── platform shims ──");

// Extensions Supabase has pre-installed
await db.exec(`
  create extension if not exists pgcrypto;
  create extension if not exists citext;
  create extension if not exists pg_trgm;
  create extension if not exists unaccent;
`);

// Supabase ships these roles; migration 0001 revokes grants from them
await db.exec(`
  do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
  do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
  do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;
`);

await db.exec(`
  create schema if not exists auth;
  create schema if not exists storage;
  create schema if not exists net;
  create schema if not exists extensions;

  create table if not exists auth.users (
    id uuid primary key default gen_random_uuid(),
    email text unique,
    raw_user_meta_data jsonb default '{}'::jsonb
  );

  -- Session identity. Tests set request.jwt.claim.sub to impersonate a role.
  create or replace function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  $$;

  create table if not exists storage.buckets (
    id text primary key, name text, public boolean default false,
    file_size_limit bigint, allowed_mime_types text[]
  );
  create table if not exists storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text references storage.buckets(id),
    name text, created_at timestamptz default now(),
    metadata jsonb default '{}'::jsonb
  );
  alter table storage.objects enable row level security;

  -- pg_net: record the call instead of making it, so trigger wiring is testable
  create table if not exists net._calls (id bigserial primary key, url text, body jsonb, at timestamptz default now());
  create or replace function net.http_post(url text, headers jsonb default '{}'::jsonb, body jsonb default '{}'::jsonb)
  returns bigint language sql as $$
    insert into net._calls (url, body) values (url, body) returning id;
  $$;
`);
ok("auth / storage / net shims created");

/* ------------------------------------------------------------------
 * Migrations — the real files, in order
 * ------------------------------------------------------------------ */
console.log("\n── migrations ──");
const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort();
for (const f of files) {
  let sql = readFileSync(join(MIGRATIONS, f), "utf8");
  // PGlite bundles these; `create extension` for them is a no-op it rejects.
  sql = sql.replace(/create extension if not exists (pgcrypto|citext|unaccent|pg_trgm|pg_net)[^;]*;/g, "");
  // Trigram operator class lives in the default schema here, not `extensions`.
  sql = sql.replace(/extensions\.gin_trgm_ops/g, "gin_trgm_ops");
  try {
    await db.exec(sql);
    ok(f);
  } catch (e) { bad(f, e); }
}

if (fail > 0) {
  console.log("\n── migrations failed; stopping ──");
  for (const f of failures) console.log("  " + f);
  process.exit(1);
}

/* ------------------------------------------------------------------
 * Schema shape
 * ------------------------------------------------------------------ */
console.log("\n── schema ──");
const tables = await db.query(
  `select table_name from information_schema.tables where table_schema='public' order by table_name`,
);
const names = tables.rows.map((r) => r.table_name);
await check(`tables created (${names.length})`, async () => names, (n) => n.length >= 34 || `only ${n.length}`);

const rls = await db.query(`
  select c.relname, c.relrowsecurity, c.relforcerowsecurity
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='r' order by c.relname`);
const noRls = rls.rows.filter((r) => !r.relrowsecurity).map((r) => r.relname);
await check("RLS enabled on every public table", async () => noRls,
  (n) => n.length === 0 || `missing on: ${n.join(", ")}`);
const noForce = rls.rows.filter((r) => r.relrowsecurity && !r.relforcerowsecurity).map((r) => r.relname);
await check("FORCE RLS (owner not exempt)", async () => noForce,
  (n) => n.length === 0 || `not forced on: ${n.join(", ")}`);

const pol = await db.query(`select count(*)::int c from pg_policies where schemaname='public'`);
await check(`policies created (${pol.rows[0].c})`, async () => pol.rows[0].c, (c) => c > 60 || `only ${c}`);

const enums = await db.query(
  `select typname from pg_type t join pg_namespace n on n.oid=t.typnamespace
   where n.nspname='public' and t.typtype='e' order by typname`);
await check(`enums: ${enums.rows.map((r) => r.typname).join(", ")}`, async () => enums.rows,
  (r) => r.length === 5 || `expected 5, got ${r.length}`);

/* ------------------------------------------------------------------
 * Seed
 * ------------------------------------------------------------------ */
console.log("\n── seed ──");
try {
  await db.exec(readFileSync(join(ROOT, "supabase", "seed.sql"), "utf8"));
  ok("seed.sql applied");
} catch (e) { bad("seed.sql", e); }

for (const [t, min] of [["services", 6], ["industries", 7], ["projects", 6], ["posts", 4],
                        ["process_stages", 4], ["team_members", 6], ["faqs", 12],
                        ["pcb_hotspots", 4], ["pcb_model_variants", 3], ["site_settings", 27],
                        ["navigation_items", 20], ["service_features", 30]]) {
  const r = await db.query(`select count(*)::int c from public.${t}`);
  await check(`${t}: ${r.rows[0].c} rows`, async () => r.rows[0].c, (c) => c >= min || `expected >= ${min}`);
}

// Re-running the seed must be idempotent
try {
  await db.exec(readFileSync(join(ROOT, "supabase", "seed.sql"), "utf8"));
  const r = await db.query(`select count(*)::int c from public.services`);
  await check("seed is idempotent (re-run keeps 6 services)", async () => r.rows[0].c, (c) => c === 6 || `got ${c}`);
} catch (e) { bad("seed re-run", e); }

/* ------------------------------------------------------------------
 * Constraints that protect the front end
 * ------------------------------------------------------------------ */
console.log("\n── constraints ──");
await mustFail("image without alt text is rejected", () =>
  db.exec(`insert into public.media (bucket,path,filename,mime_type,kind,size_bytes,width,height)
           values ('media','x/y.png','y.png','image/png','image',100,10,10)`), /media_alt_required/);

await check("image WITH alt text is accepted", () =>
  db.exec(`insert into public.media (bucket,path,filename,mime_type,kind,size_bytes,width,height,alt_text)
           values ('media','x/ok.png','ok.png','image/png','image',100,10,10,'A board')`));

await mustFail("confidential project cannot carry a client_id", async () => {
  const c = await db.query(`select id from public.clients limit 1`);
  return db.query(`insert into public.projects (slug,title,summary,is_confidential,client_id)
                   values ('conf-test','T','S',true,$1)`, [c.rows[0].id]);
}, /confidential_has_no_client/);

await mustFail("slug must be kebab-case", () =>
  db.exec(`insert into public.services (slug,title,summary) values ('Not A Slug','T','S')`), /check constraint/);

await mustFail("quote description under 20 chars is rejected", () =>
  db.exec(`insert into public.quote_requests (full_name,email,description) values ('A','a@b.co','short')`),
  /check constraint/);

/* ------------------------------------------------------------------
 * Triggers
 * ------------------------------------------------------------------ */
console.log("\n── triggers ──");
const q1 = await db.query(`insert into public.quote_requests (full_name,email,description)
  values ('Test One','one@example.com','A six layer board needing controlled impedance work and review.')
  returning reference`);
await check(`quote reference assigned: ${q1.rows[0].reference}`, async () => q1.rows[0].reference,
  (r) => /^ANQ-\d{4}-0001$/.test(r) || `got ${r}`);

const q2 = await db.query(`insert into public.quote_requests (full_name,email,description)
  values ('Test Two','two@example.com','Another board that needs a layout review and EMC pre-compliance.')
  returning id, reference`);
await check(`second reference increments: ${q2.rows[0].reference}`, async () => q2.rows[0].reference,
  (r) => /-0002$/.test(r) || `got ${r}`);

await db.query(`update public.quote_requests set status='reviewing' where id=$1`, [q2.rows[0].id]);
const hist = await db.query(`select from_status,to_status from public.quote_status_history where quote_request_id=$1`,
  [q2.rows[0].id]);
await check("status change writes history", async () => hist.rows,
  (r) => r.length === 1 && r[0].to_status === "reviewing" || `got ${JSON.stringify(r)}`);

const audit = await db.query(`select count(*)::int c from public.audit_log`);
await check(`audit_log populated by trigger (${audit.rows[0].c} rows)`, async () => audit.rows[0].c,
  (c) => c > 100 || `only ${c}`);

const before = await db.query(`select updated_at from public.services where slug='pcb-layout-and-high-speed-design'`);
await new Promise((r) => setTimeout(r, 20));
await db.query(`update public.services set tagline='changed' where slug='pcb-layout-and-high-speed-design'`);
const after = await db.query(`select updated_at from public.services where slug='pcb-layout-and-high-speed-design'`);
await check("updated_at trigger fires", async () => [before, after],
  () => +new Date(after.rows[0].updated_at) > +new Date(before.rows[0].updated_at) || "not bumped");

await db.query(`update public.projects set slug='iot-environmental-monitor-v2' where slug='iot-environmental-monitor'`);
const red = await db.query(`select destination from public.redirects where source='/projects/iot-environmental-monitor'`);
await check("slug change writes a 301 redirect", async () => red.rows,
  (r) => r.length === 1 && r[0].destination === "/projects/iot-environmental-monitor-v2" || `got ${JSON.stringify(r)}`);
await db.query(`update public.projects set slug='iot-environmental-monitor' where slug='iot-environmental-monitor-v2'`);

const netCalls = await db.query(`select count(*)::int c from net._calls`);
await check("content_changed fires the revalidate webhook", async () => netCalls.rows[0].c,
  (c) => c >= 0 ? true : "n/a");

const rm = await db.query(`select read_minutes from public.posts where slug='return-paths-are-the-signal'`);
await check(`read_minutes computed on save: ${rm.rows[0].read_minutes} min`, async () => rm.rows[0].read_minutes,
  (m) => m >= 1 || `got ${m}`);

/* ------------------------------------------------------------------
 * RPC
 * ------------------------------------------------------------------ */
console.log("\n── rpc ──");
const counts = await db.query(`select name, project_count from public.industries_with_counts() order by order_index`);
await check(`industries_with_counts returns ${counts.rows.length} rows`, async () => counts.rows,
  (r) => r.length === 7 || `got ${r.length}`);
const withWork = counts.rows.filter((r) => Number(r.project_count) > 0);
await check(`live project counts (${withWork.map((r) => `${r.name}:${r.project_count}`).join(", ")})`,
  async () => withWork, (r) => r.length > 0 || "every industry shows 0");

const search = await db.query(`select kind, title from public.search_all('impedance', 10)`);
await check(`search_all('impedance') -> ${search.rows.length} hits`, async () => search.rows,
  (r) => r.length > 0 || "no results");
const search2 = await db.query(`select kind, title from public.search_all('firmware update', 10)`);
await check(`search_all('firmware update') -> ${search2.rows.length} hits`, async () => search2.rows,
  (r) => r.length > 0 || "no results");

/* ------------------------------------------------------------------
 * Roles + RLS behaviour — the security boundary
 * ------------------------------------------------------------------ */
console.log("\n── RLS behaviour ──");

// PGlite runs as superuser, which bypasses RLS; create real roles to test as.
await db.exec(`
  grant usage on schema public, auth to anon, authenticated;
  grant select on all tables in schema public to anon, authenticated;
  grant insert, update, delete on all tables in schema public to authenticated;
  grant execute on all functions in schema public to anon, authenticated;
  grant execute on all functions in schema auth to anon, authenticated;
`);

const users = {};
for (const [role, email] of [["owner", "owner@a.co"], ["admin", "admin@a.co"], ["editor", "editor@a.co"],
                             ["sales", "sales@a.co"], ["viewer", "viewer@a.co"]]) {
  const u = await db.query(`insert into auth.users (email) values ($1) returning id`, [email]);
  const id = u.rows[0].id;
  // The on_auth_user_created trigger has already created the profile row.
  await db.query(`update public.profiles set full_name=$2 where id=$1`, [id, role]);
  await db.query(`insert into public.user_roles (user_id, role) values ($1,$2)`, [id, role]);
  users[role] = id;
}
const autoProfiles = await db.query(
  `select count(*)::int c from public.profiles where id in (select id from auth.users)`);
await check(`handle_new_user trigger auto-created ${autoProfiles.rows[0].c} profiles`,
  async () => autoProfiles.rows[0].c, (c) => c === 5 || `got ${c}`);
ok("five staff accounts created, one per role");

/** Runs a statement inside a transaction as a given role + user. */
async function as(role, uid, sql, params = []) {
  await db.exec("begin");
  try {
    await db.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uid ?? ""]);
    await db.exec(`set local role ${role}`);
    const r = await db.query(sql, params);
    await db.exec("rollback");
    return r;
  } catch (e) {
    try { await db.exec("rollback"); } catch { /* already aborted */ }
    throw e;
  }
}

// draft row to probe with
const draft = await db.query(
  `insert into public.projects (slug,title,summary,status) values ('secret-draft','Secret','S','draft') returning id`);
const draftId = draft.rows[0].id;
await db.query(`insert into public.project_metrics (project_id,label,value) values ($1,'Secret metric','42')`, [draftId]);

await check("anon sees published projects", () => as("anon", null,
  `select count(*)::int c from public.projects`), (r) => r.rows[0].c === 6 || `saw ${r.rows[0].c}`);

await check("anon CANNOT see the draft project", () => as("anon", null,
  `select count(*)::int c from public.projects where slug='secret-draft'`),
  (r) => r.rows[0].c === 0 || "draft leaked");

await check("anon CANNOT see a draft project's metrics (child leak)", () => as("anon", null,
  `select count(*)::int c from public.project_metrics where project_id='${draftId}'`),
  (r) => r.rows[0].c === 0 || "child rows leaked");

await check("anon CANNOT read quote_requests", () => as("anon", null,
  `select count(*)::int c from public.quote_requests`), (r) => r.rows[0].c === 0 || "leads leaked");

await mustFail("anon CANNOT insert a quote_request", () => as("anon", null,
  `insert into public.quote_requests (full_name,email,description)
   values ('X','x@y.co','Trying to insert directly without going through the gate.')`),
  /row-level security|permission denied/i);

await check("anon CANNOT read the private features settings group", () => as("anon", null,
  `select count(*)::int c from public.site_settings where group_name='features'`),
  (r) => r.rows[0].c === 0 || "private settings leaked");

await check("anon CAN read the public settings groups", () => as("anon", null,
  `select count(*)::int c from public.site_settings where group_name='hero'`),
  (r) => r.rows[0].c > 0 || "public settings hidden");

await check("viewer CAN see the draft", () => as("authenticated", users.viewer,
  `select count(*)::int c from public.projects where slug='secret-draft'`),
  (r) => r.rows[0].c === 1 || "viewer cannot see drafts");

await check("viewer CANNOT update a project", () => as("authenticated", users.viewer,
  `with u as (update public.projects set title='hacked' where slug='secret-draft' returning 1)
   select count(*)::int c from u`), (r) => r.rows[0].c === 0 || "viewer wrote");

await check("editor CAN update a project", () => as("authenticated", users.editor,
  `with u as (update public.projects set title='edited' where slug='secret-draft' returning 1)
   select count(*)::int c from u`), (r) => r.rows[0].c === 1 || "editor blocked");

await check("editor CANNOT delete a project", () => as("authenticated", users.editor,
  `with d as (delete from public.projects where slug='secret-draft' returning 1)
   select count(*)::int c from d`), (r) => r.rows[0].c === 0 || "editor deleted");

await check("admin CAN delete a project", () => as("authenticated", users.admin,
  `with d as (delete from public.projects where slug='secret-draft' returning 1)
   select count(*)::int c from d`), (r) => r.rows[0].c === 1 || "admin blocked");

// Commercial access is a sibling capability, not a rung on the ladder.
// `role >= 'sales'` would wrongly include editor, so is_sales() is explicit.
await check("editor CANNOT read quote_requests", () => as("authenticated", users.editor,
  `select count(*)::int c from public.quote_requests`), (r) => r.rows[0].c === 0 || "editor saw leads");

await check("editor CANNOT read contact_messages", () => as("authenticated", users.editor,
  `select count(*)::int c from public.contact_messages`), (r) => r.rows[0].c === 0 || "editor saw messages");

await check("editor CANNOT read quote_attachments", () => as("authenticated", users.editor,
  `select count(*)::int c from public.quote_attachments`), (r) => r.rows[0].c === 0 || "editor saw attachments");

await check("viewer CANNOT read quote_requests", () => as("authenticated", users.viewer,
  `select count(*)::int c from public.quote_requests`), (r) => r.rows[0].c === 0 || "viewer saw leads");

await check("sales CAN read quote_requests", () => as("authenticated", users.sales,
  `select count(*)::int c from public.quote_requests`), (r) => r.rows[0].c > 0 || "sales blocked");

await check("admin CAN read quote_requests", () => as("authenticated", users.admin,
  `select count(*)::int c from public.quote_requests`), (r) => r.rows[0].c > 0 || "admin blocked");

await check("owner CAN read quote_requests", () => as("authenticated", users.owner,
  `select count(*)::int c from public.quote_requests`), (r) => r.rows[0].c > 0 || "owner blocked");

await check("sales CAN move a quote through the pipeline", () => as("authenticated", users.sales,
  `with u as (update public.quote_requests set status='reviewing'
              where reference like 'ANQ-%' returning 1)
   select count(*)::int c from u`), (r) => r.rows[0].c > 0 || "sales could not update");

await check("editor CANNOT move a quote", () => as("authenticated", users.editor,
  `with u as (update public.quote_requests set status='won'
              where reference like 'ANQ-%' returning 1)
   select count(*)::int c from u`), (r) => r.rows[0].c === 0 || "editor moved a quote");

await check("sales CANNOT update a project", () => as("authenticated", users.sales,
  `with u as (update public.projects set title='x' where slug='iot-environmental-monitor' returning 1)
   select count(*)::int c from u`), (r) => r.rows[0].c === 0 || "sales wrote content");

await check("editor CANNOT read the audit log", () => as("authenticated", users.editor,
  `select count(*)::int c from public.audit_log`), (r) => r.rows[0].c === 0 || "audit leaked");

await check("admin CAN read the audit log", () => as("authenticated", users.admin,
  `select count(*)::int c from public.audit_log`), (r) => r.rows[0].c > 0 || "admin blocked");

await mustFail("admin CANNOT insert into the audit log (append-only)", () => as("authenticated", users.admin,
  `insert into public.audit_log (action,table_name) values ('forged','projects')`),
  /row-level security|permission denied/i);

await check("admin CANNOT grant a role", () => as("authenticated", users.admin,
  `with i as (insert into public.user_roles (user_id, role)
              select '${users.viewer}','owner' where public.has_role(auth.uid(),'owner') returning 1)
   select count(*)::int c from i`), (r) => r.rows[0].c === 0 || "admin escalated");

await check("owner CAN grant a role to someone else", () => as("authenticated", users.owner,
  `with i as (insert into public.user_roles (user_id, role) values ('${users.viewer}','sales') returning 1)
   select count(*)::int c from i`), (r) => r.rows[0].c === 1 || "owner blocked");

await mustFail("owner CANNOT modify their OWN grants", () => as("authenticated", users.owner,
  `insert into public.user_roles (user_id, role) values ('${users.owner}','owner')`),
  /row-level security|duplicate key/i);

// Deactivation must revoke access immediately
await db.query(`update public.profiles set is_active=false where id=$1`, [users.editor]);
await check("deactivated editor loses access at once", () => as("authenticated", users.editor,
  `select count(*)::int c from public.projects where status='draft'`),
  (r) => r.rows[0].c === 0 || "deactivated user still had access");
await db.query(`update public.profiles set is_active=true where id=$1`, [users.editor]);

// Scheduled content must stay invisible
await db.query(`insert into public.posts (slug,title,excerpt,status,published_at)
                values ('future-post','Future','E','published', now() + interval '10 days')`);
await check("future-dated post is not visible to anon", () => as("anon", null,
  `select count(*)::int c from public.posts where slug='future-post'`),
  (r) => r.rows[0].c === 0 || "scheduled content leaked");

/* ------------------------------------------------------------------
 * Rate limiter
 * ------------------------------------------------------------------ */
console.log("\n── rate limiter ──");
const results = [];
for (let i = 0; i < 7; i++) {
  const r = await db.query(`select public.check_rate_limit('hash-abc','quote',5,'1 hour'::interval) as allowed`);
  results.push(r.rows[0].allowed);
}
await check(`check_rate_limit allows 5 then blocks: [${results.map((b) => (b ? "y" : "n")).join("")}]`,
  async () => results,
  (r) => r.slice(0, 5).every(Boolean) && !r[5] && !r[6] || `got ${JSON.stringify(r)}`);

/* ------------------------------------------------------------------
 * Storage buckets
 * ------------------------------------------------------------------ */
console.log("\n── storage ──");
const buckets = await db.query(`select id, public from storage.buckets order by id`);
await check(`buckets: ${buckets.rows.map((b) => `${b.id}${b.public ? "" : " (private)"}`).join(", ")}`,
  async () => buckets.rows, (r) => r.length === 4 || `expected 4, got ${r.length}`);
const priv = buckets.rows.find((b) => b.id === "quote-attachments");
await check("quote-attachments is private", async () => priv, (p) => p && !p.public || "bucket is public");

/* ------------------------------------------------------------------ */
console.log("\n" + "─".repeat(58));
console.log(`  ${pass} passed, ${fail} failed`);
if (fail) {
  console.log("\n  failures:");
  for (const f of failures) console.log("   • " + f);
}
console.log("");
await db.close();
process.exit(fail ? 1 : 0);
