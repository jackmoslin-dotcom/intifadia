import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, beforeEach, describe, it, expect } from "vitest";
import { questions } from "../src/survey";
const db = new PGlite();
const owners = {
  owner: "00000000-0000-4000-8000-000000000001",
  analyst: "00000000-0000-4000-8000-000000000002",
  moderator: "00000000-0000-4000-8000-000000000003",
  nobody: "00000000-0000-4000-8000-000000000004",
};
const rpc = async (name: string, args: unknown[] = []) => {
  const r = await db.query<{ result: any }>(
    `select public.${name}(${args.map((_, i) => "$" + (i + 1)).join(",")}) as result`,
    args,
  );
  return r.rows[0].result;
};
async function identity(
  role: "anon" | "authenticated" | "service_role",
  user?: string,
  aal = "aal2",
) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claims',$1,false)", [
    JSON.stringify({ sub: user, aal }),
  ]);
  await db.exec(`set role ${role}`);
}
async function admin(role: keyof typeof owners = "owner", aal = "aal2") {
  await identity("authenticated", owners[role], aal);
}
async function submit(answers: unknown, id = crypto.randomUUID()) {
  await identity("service_role");
  return rpc("submit_response", [id, answers]);
}
beforeAll(async () => {
  await db.exec(
    "create role anon; create role authenticated; create role service_role; create schema auth; grant usage on schema auth to public; create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$; create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;",
  );
  await db.exec(readFileSync("supabase/migrations/001_core.sql", "utf8"));
  await db.exec(readFileSync("supabase/migrations/002_questions.sql", "utf8"));
  for (const [role, id] of Object.entries(owners).filter(
    ([r]) => r !== "nobody",
  ))
    await db.query("insert into admin_roles(user_id,role) values($1,$2)", [
      id,
      role,
    ]);
});
afterAll(() => db.close());
beforeEach(async () => {
  await db.exec(
    "reset role; truncate responses,demands,rate_buckets,audit_log restart identity cascade; update settings set retention_days=180,suppression_threshold=5;",
  );
});
describe("PostgreSQL migrations and authorization", () => {
  it("overview returns real role-specific counts", async () => {
    await submit({ demand: "synthetic demand", comment: "synthetic comment" });
    await admin("moderator");
    expect(await rpc("admin_action", ["overview", {}])).toMatchObject({
      role: "moderator",
      statistics: null,
      moderation: { pending: 2, approved: 0, rejected: 0 },
    });
    await admin("analyst");
    expect(await rpc("admin_action", ["overview", {}])).toMatchObject({
      role: "analyst",
      statistics: { total: null },
      moderation: null,
    });
  });
  it("rolls back the response if a dependent written-text insert fails", async () => {
    await db.exec(
      "create function public.test_fail_demand() returns trigger language plpgsql as $$ begin raise exception 'synthetic insert failure'; end $$; create trigger test_fail before insert on demands for each row execute function public.test_fail_demand();",
    );
    try {
      await expect(submit({ demand: "synthetic" })).rejects.toThrow(
        "synthetic insert failure",
      );
      await db.exec("reset role");
      expect(
        (await db.query<any>("select count(*) n from responses")).rows[0].n,
      ).toBe(0);
    } finally {
      await db.exec(
        "reset role; drop trigger test_fail on demands; drop function public.test_fail_demand();",
      );
    }
  });
  it("all 35 question definitions match source", async () => {
    const result = await db.query<{ definition: any }>(
      "select definition from question_definitions order by id",
    );
    expect(result.rows.map((r) => r.definition)).toEqual(
      [...questions].sort((a, b) => a.id.localeCompare(b.id)),
    );
  });
  for (const q of questions)
    it(`${q.id}: PostgreSQL accepts valid and rejects invalid values`, async () => {
      const a: any = {
        ...(q.condition
          ? { [q.condition.question]: q.condition.values[0] }
          : {}),
        [q.id]:
          q.type === "text" ? "اختبار اصطناعي" : q.multiple ? ["v1"] : "v1",
      };
      expect(await submit(a)).toMatch(/^[0-9a-f-]{36}$/);
      await expect(
        submit({
          ...a,
          [q.id]:
            q.type === "text" ? "x".repeat(1001) : q.multiple ? ["bad"] : "bad",
        }),
      ).rejects.toThrow();
      await expect(submit({ ...a, [q.id]: null })).rejects.toThrow();
      if (q.multiple) {
        for (const exclusive of q.exclusiveOptions)
          await expect(
            submit({ ...a, [q.id]: ["v1", exclusive] }),
          ).rejects.toThrow();
        await expect(submit({ ...a, [q.id]: ["v1", "v1"] })).rejects.toThrow();
        await expect(
          submit({ ...a, [q.id]: ["v1", "v2", "v3", "v4"] }),
        ).rejects.toThrow();
      }
      if (q.condition)
        await expect(submit({ [q.id]: a[q.id] })).rejects.toThrow();
    });
  it("submits atomically, deduplicates and rejects conflicting retries", async () => {
    const id = crypto.randomUUID();
    await submit({ demand: "اختبار", city: "v1" }, id);
    await submit({ demand: "اختبار", city: "v1" }, id);
    await expect(submit({ city: "v2" }, id)).rejects.toThrow(
      "idempotency conflict",
    );
    await expect(submit({ demand: "private", city: "bad" })).rejects.toThrow();
    await db.exec("reset role");
    expect(
      (await db.query<any>("select count(*) n from responses")).rows[0].n,
    ).toBe(1);
    expect(
      (await db.query<any>("select count(*) n from demands")).rows[0].n,
    ).toBe(1);
  });
  it("rejects unknown fields and direct invalid writes", async () => {
    await expect(submit({ unknown: "v1" })).rejects.toThrow();
    await db.exec("reset role");
    await expect(
      db.query("insert into responses(id,answers) values($1,$2)", [
        crypto.randomUUID(),
        { city: "bad" },
      ]),
    ).rejects.toThrow();
  });
  it("anon cannot read raw tables or invoke privileged RPCs", async () => {
    await identity("anon");
    for (const t of [
      "responses",
      "demands",
      "admin_roles",
      "audit_log",
      "settings",
      "rate_buckets",
    ])
      await expect(db.query(`select * from ${t}`)).rejects.toThrow();
    for (const [f, args] of [
      ["submit_response", [crypto.randomUUID(), {}]],
      ["consume_rate", ["x"]],
      ["admin_action", ["session", {}]],
      ["validate_answers", [{}]],
    ] as [string, unknown[]][])
      await expect(rpc(f, args)).rejects.toThrow();
  });
  it("RLS still blocks reads if a table grant is accidentally added", async () => {
    await submit({ city: "v1" });
    await db.exec("reset role; grant select on responses to anon;");
    await identity("anon");
    expect((await db.query("select * from responses")).rows).toEqual([]);
    await db.exec("reset role; revoke select on responses from anon;");
  });
  it("empty stats are real empty values and small groups are suppressed", async () => {
    await identity("anon");
    expect(await rpc("public_statistics")).toMatchObject({
      total: null,
      distributions: {},
      weekly: [],
    });
    for (let i = 0; i < 5; i++) await submit({ city: "v1", gender: "v1" });
    await identity("anon");
    let stats = await rpc("public_statistics");
    expect(stats.total).toBe(5);
    expect(stats.distributions.city[0].count).toBe(5);
    await submit({ city: "v2", gender: "v1" });
    await identity("anon");
    stats = await rpc("public_statistics");
    expect(stats.distributions.city).toBeUndefined();
    expect(stats.distributions.gender[0].count).toBe(6);
    expect(JSON.stringify(stats)).not.toContain("answers");
  });
  it("multi-select counts and completed weekly buckets are accurate", async () => {
    for (let i = 0; i < 5; i++) await submit({ priorities: ["v1", "v2"] });
    await db.exec(
      "reset role; update responses set created_at=now()-interval '14 days'",
    );
    await identity("anon");
    const s = await rpc("public_statistics");
    expect(s.distributions.priorities.map((b: any) => b.count)).toEqual([5, 5]);
    expect(s.weekly).toHaveLength(1);
    expect(s.weekly[0].count).toBe(5);
  });
  it("MFA and administrative role are required server-side", async () => {
    await admin("owner", "aal1");
    await expect(rpc("admin_action", ["session", {}])).rejects.toThrow(
      "MFA required",
    );
    await admin("nobody");
    await expect(rpc("admin_action", ["session", {}])).rejects.toThrow(
      "forbidden",
    );
    await admin("analyst");
    await expect(rpc("admin_action", ["demands", {}])).rejects.toThrow(
      "forbidden",
    );
    await admin("moderator");
    await expect(rpc("admin_action", ["export", {}])).rejects.toThrow(
      "forbidden",
    );
    await expect(
      rpc("admin_action", [
        "delete_expired",
        { confirmation: "DELETE EXPIRED" },
      ]),
    ).rejects.toThrow("forbidden");
  });
  it("written texts stay private, only reviewed redaction is public, rejection unpublishes", async () => {
    await submit({ demand: "synthetic private identifier" });
    await identity("anon");
    expect(await rpc("public_demands")).toEqual([]);
    await admin("moderator");
    await expect(
      rpc("admin_action", [
        "moderate",
        { id: 1, status: "approved", safeText: "safe", reviewed: false },
      ]),
    ).rejects.toThrow();
    await rpc("admin_action", [
      "moderate",
      { id: 1, status: "approved", safeText: "تحسين الخدمات", reviewed: true },
    ]);
    await identity("anon");
    expect(await rpc("public_demands")).toEqual([
      { id: 1, text: "تحسين الخدمات" },
    ]);
    await admin("moderator");
    await rpc("admin_action", ["moderate", { id: 1, status: "rejected" }]);
    await identity("anon");
    expect(await rpc("public_demands")).toEqual([]);
  });
  it("settings bounds, confirmed deletion, cascade and audit work", async () => {
    await submit({ demand: "expired" });
    await db.exec(
      "reset role; update responses set created_at=now()-interval '200 days'",
    );
    await submit({ demand: "fresh" });
    await admin();
    await expect(
      rpc("admin_action", [
        "save_settings",
        { retentionDays: 1, threshold: 1 },
      ]),
    ).rejects.toThrow();
    await rpc("admin_action", [
      "save_settings",
      { retentionDays: 90, threshold: 10 },
    ]);
    await expect(rpc("admin_action", ["delete_expired", {}])).rejects.toThrow();
    expect(
      await rpc("admin_action", [
        "delete_expired",
        { confirmation: "DELETE EXPIRED" },
      ]),
    ).toEqual({ deleted: 1 });
    expect(await rpc("admin_action", ["demands", {}])).toHaveLength(1);
    expect(
      (await rpc("admin_action", ["audit", {}])).map((a: any) => a.action),
    ).toEqual(["delete_expired", "save_settings"]);
  });
  it("distributed rate bucket permits ten attempts then rejects and expires", async () => {
    await identity("service_role");
    for (let i = 0; i < 10; i++)
      expect(await rpc("consume_rate", ["synthetic"])).toBe(true);
    expect(await rpc("consume_rate", ["synthetic"])).toBe(false);
    await db.exec(
      "reset role; update rate_buckets set expires_at=now()-interval '1 second'",
    );
    await identity("service_role");
    expect(await rpc("consume_rate", ["synthetic"])).toBe(true);
  });
});
