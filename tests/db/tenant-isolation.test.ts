/**
 * Tenant-isolation matrix (docs/security-plan.md §4), executed at the SQL
 * level as the `authenticated` / `anon` roles with Clerk-shaped JWT claims,
 * against the real migrations on the Supabase Postgres image.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  admin,
  asRole,
  asUser,
  claimsFor,
  closePool,
  createClinicFixture,
  deleteClinicFixture,
  type ClinicFixture,
} from "../helpers/db";

let A: ClinicFixture;
let B: ClinicFixture;

const TENANT_TABLES = [
  "clinics",
  "clinic_members",
  "patients",
  "leads",
  "appointments",
  "tasks",
  "activity_events",
  "clinic_entitlements",
] as const;

beforeAll(async () => {
  A = await createClinicFixture("A");
  B = await createClinicFixture("B");
});

afterAll(async () => {
  await deleteClinicFixture(A);
  await deleteClinicFixture(B);
  await closePool();
});

describe("TI-01 listing is scoped to the caller's clinic", () => {
  for (const table of TENANT_TABLES) {
    it(`${table}: A-staff sees only Clinic A rows`, async () => {
      const column = table === "clinics" ? "id" : "clinic_id";
      const result = await asUser(A.staff.claims, (q) =>
        q<{ cid: string }>(`select distinct ${column}::text as cid from public.${table}`),
      );
      expect(result.error).toBeNull();
      expect(result.rows.map((r) => r.cid)).toEqual([A.id]);
    });
  }
});

describe("TI-02 guessing another clinic's record id returns nothing", () => {
  it.each([
    ["patients", () => B.patientId],
    ["leads", () => B.leadId],
    ["appointments", () => B.appointmentId],
    ["tasks", () => B.taskId],
    ["clinic_members", () => B.owner.memberId],
  ])("%s", async (table, id) => {
    const result = await asUser(A.owner.claims, (q) => q(`select * from public.${table} where id = $1`, [id()]));
    expect(result.error).toBeNull();
    expect(result.rowCount).toBe(0);
  });
});

describe("TI-03 cannot create records under another clinic", () => {
  it("explicit clinic_id is not even insertable", async () => {
    const result = await asUser(A.staff.claims, (q) =>
      q("insert into public.leads (clinic_id, full_name) values ($1, 'Injected')", [B.id]),
    );
    expect(result.error?.code).toBe("42501");
  });

  it("default clinic_id always resolves to the caller's clinic", async () => {
    const result = await asUser(A.staff.claims, (q) =>
      q<{ clinic_id: string }>("insert into public.leads (full_name) values ('Synthetic New Lead') returning clinic_id"),
    );
    expect(result.error).toBeNull();
    expect(result.rows[0]?.clinic_id).toBe(A.id);
  });
});

describe("TI-04 cannot update or delete another clinic's records", () => {
  it("update by id affects 0 rows", async () => {
    const result = await asUser(A.owner.claims, (q) =>
      q("update public.leads set full_name = 'Hijacked' where id = $1", [B.leadId]),
    );
    expect(result.error).toBeNull();
    expect(result.rowCount).toBe(0);
  });

  it("delete by id affects 0 rows", async () => {
    const result = await asUser(A.owner.claims, (q) => q("delete from public.tasks where id = $1", [B.taskId]));
    expect(result.error).toBeNull();
    expect(result.rowCount).toBe(0);
    const still = await admin("select 1 from public.tasks where id = $1", [B.taskId]);
    expect(still.rowCount).toBe(1);
  });
});

describe("TI-05 tenant id cannot be moved", () => {
  it("clinic_id is not updatable (column privilege)", async () => {
    const result = await asUser(A.owner.claims, (q) =>
      q("update public.leads set clinic_id = $1 where id = $2", [B.id, A.leadId]),
    );
    expect(result.error?.code).toBe("42501");
  });

  it("created_by is not updatable", async () => {
    const result = await asUser(A.owner.claims, (q) =>
      q("update public.leads set created_by = 'user_spoof' where id = $1", [A.leadId]),
    );
    expect(result.error?.code).toBe("42501");
  });

  it("the immutability trigger blocks even privileged updates of clinic_id", async () => {
    await expect(admin("update public.leads set clinic_id = $1 where id = $2", [B.id, A.leadId])).rejects.toThrow(
      /immutable/,
    );
  });
});

describe("TI-06 cross-tenant references are rejected", () => {
  it("A lead cannot point at a Clinic B patient", async () => {
    const result = await asUser(A.staff.claims, (q) =>
      q("insert into public.leads (full_name, patient_id) values ('X', $1)", [B.patientId]),
    );
    expect(result.error?.code).toBe("23503");
  });

  it("A lead cannot be assigned to a Clinic B member", async () => {
    const result = await asUser(A.staff.claims, (q) =>
      q("update public.leads set assigned_to = $1 where id = $2", [B.staff.memberId, A.leadId]),
    );
    // The active-assignee trigger (23514) fires before the composite FK (23503).
    expect(["23503", "23514"]).toContain(result.error?.code);
  });

  it("A task cannot reference a Clinic B appointment", async () => {
    const result = await asUser(A.staff.claims, (q) =>
      q("insert into public.tasks (title, appointment_id) values ('X', $1)", [B.appointmentId]),
    );
    expect(result.error?.code).toBe("23503");
  });

  it("A appointment cannot be booked for a Clinic B lead", async () => {
    const result = await asUser(A.staff.claims, (q) =>
      q("insert into public.appointments (lead_id, starts_at) values ($1, now() + interval '1 day')", [B.leadId]),
    );
    expect(result.error?.code).toBe("23503");
  });
});

describe("TI-07 viewers cannot write", () => {
  it.each([
    ["insert lead", "insert into public.leads (full_name) values ('Viewer write')", []],
    ["insert patient", "insert into public.patients (full_name) values ('Viewer write')", []],
    ["insert task", "insert into public.tasks (title) values ('Viewer write')", []],
  ])("%s is rejected by RLS", async (_name, sql, params) => {
    const result = await asUser(A.viewer.claims, (q) => q(sql, params));
    expect(result.error?.code).toBe("42501");
  });

  it.each([
    ["update lead", "update public.leads set notes = 'x' where id = $1", () => [A.leadId]],
    ["update appointment", "update public.appointments set notes = 'x' where id = $1", () => [A.appointmentId]],
    ["delete task", "delete from public.tasks where id = $1", () => [A.taskId]],
  ])("%s affects 0 rows", async (_name, sql, params) => {
    const result = await asUser(A.viewer.claims, (q) => q(sql, params()));
    expect(result.error).toBeNull();
    expect(result.rowCount).toBe(0);
  });

  it("staff cannot delete (owner/admin only)", async () => {
    const result = await asUser(A.staff.claims, (q) => q("delete from public.tasks where id = $1", [A.taskId]));
    expect(result.rowCount).toBe(0);
  });

  it("admin can delete", async () => {
    const result = await asUser(A.admin.claims, (q) => q("delete from public.tasks where id = $1", [A.taskId]));
    expect(result.error).toBeNull();
    expect(result.rowCount).toBe(1);
  });
});

describe("TI-08 no self-escalation", () => {
  it("clinic_members cannot be written directly", async () => {
    const result = await asUser(A.staff.claims, (q) =>
      q("update public.clinic_members set role = 'owner' where id = $1", [A.staff.memberId]),
    );
    expect(result.error?.code).toBe("42501");
  });

  it("clinic_members cannot be inserted directly", async () => {
    const result = await asUser(claimsFor("user_intruderX1", A.orgId), (q) =>
      q("insert into public.clinic_members (clinic_id, clerk_user_id, role) values ($1, 'user_intruderX1', 'owner')", [
        A.id,
      ]),
    );
    expect(result.error?.code).toBe("42501");
  });

  it("staff cannot use change_member_role at all", async () => {
    const result = await asUser(A.staff.claims, (q) =>
      q("select public.change_member_role($1, 'admin')", [A.viewer.memberId]),
    );
    expect(result.error?.code).toBe("42501");
  });

  it("nobody can change their own role", async () => {
    const result = await asUser(A.admin.claims, (q) =>
      q("select public.change_member_role($1, 'staff')", [A.admin.memberId]),
    );
    expect(result.error?.code).toBe("42501");
  });

  it("admin cannot promote anyone to admin", async () => {
    const result = await asUser(A.admin.claims, (q) =>
      q("select public.change_member_role($1, 'admin')", [A.staff.memberId]),
    );
    expect(result.error?.code).toBe("42501");
  });

  it("admin can move a viewer to staff", async () => {
    const result = await asUser(A.admin.claims, async (q) => {
      const change = await q("select public.change_member_role($1, 'staff')", [A.viewer.memberId]);
      const after = await q<{ role: string }>("select role from public.clinic_members where id = $1", [
        A.viewer.memberId,
      ]);
      return { change, after };
    });
    expect(result.change.error).toBeNull();
    expect(result.after.rows[0]?.role).toBe("staff");
  });

  it("nobody can invite an owner", async () => {
    const result = await asUser(A.owner.claims, (q) =>
      q("select public.create_invitation('synthetic.owner@example.com', 'owner')"),
    );
    expect(result.error?.code).toBe("42501");
  });

  it("admin cannot invite an admin", async () => {
    const result = await asUser(A.admin.claims, (q) =>
      q("select public.create_invitation('synthetic.admin@example.com', 'admin')"),
    );
    expect(result.error?.code).toBe("42501");
  });
});

describe("TI-09/TI-10 owners are protected", () => {
  it("admin cannot change the owner's role", async () => {
    const result = await asUser(A.admin.claims, (q) =>
      q("select public.change_member_role($1, 'viewer')", [A.owner.memberId]),
    );
    expect(result.error?.code).toBe("42501");
  });

  it("admin cannot remove the owner", async () => {
    const result = await asUser(A.admin.claims, (q) => q("select public.remove_member($1)", [A.owner.memberId]));
    expect(result.error?.code).toBe("42501");
  });

  it("admin cannot remove another admin", async () => {
    const second = await admin<{ id: string }>(
      "insert into public.clinic_members (clinic_id, clerk_user_id, role) values ($1, $2, 'admin') returning id",
      [A.id, `user_secondadmin${Date.now()}`],
    );
    const result = await asUser(A.admin.claims, (q) => q("select public.remove_member($1)", [second.rows[0]!.id]));
    expect(result.error?.code).toBe("42501");
    await admin("delete from public.clinic_members where id = $1", [second.rows[0]!.id]);
  });

  it("the last owner cannot remove or demote themselves", async () => {
    const remove = await asUser(A.owner.claims, (q) => q("select public.remove_member($1)", [A.owner.memberId]));
    expect(remove.error?.code).toBe("42501");
    const demote = await asUser(A.owner.claims, (q) =>
      q("select public.change_member_role($1, 'admin')", [A.owner.memberId]),
    );
    expect(demote.error?.code).toBe("42501");
  });

  it("owner cannot manage a member of another clinic", async () => {
    const result = await asUser(A.owner.claims, (q) => q("select public.remove_member($1)", [B.staff.memberId]));
    expect(result.error?.code).toBe("P0002");
  });
});

describe("TI-11 aggregates only cover the caller's clinic", () => {
  it("dashboard_summary counts Clinic A only", async () => {
    const bCounts = await admin<{ n: string }>("select count(*)::text as n from public.patients where clinic_id = $1", [
      B.id,
    ]);
    expect(Number(bCounts.rows[0]!.n)).toBeGreaterThan(0);
    const result = await asUser(A.viewer.claims, (q) =>
      q<{ s: { patients_total: number } }>(
        "select public.dashboard_summary(now() - interval '30 days', now() + interval '30 days') as s",
      ),
    );
    expect(result.error).toBeNull();
    const own = await admin<{ n: string }>(
      "select count(*)::text as n from public.patients where clinic_id = $1 and archived_at is null",
      [A.id],
    );
    expect(result.rows[0]?.s.patients_total).toBe(Number(own.rows[0]!.n));
  });

  it("count(*) over a table never includes Clinic B", async () => {
    const result = await asUser(A.staff.claims, (q) =>
      q<{ n: string }>("select count(*)::text as n from public.leads where clinic_id = $1", [B.id]),
    );
    expect(result.rows[0]?.n).toBe("0");
  });
});

describe("TI-12..TI-15 missing, wrong or stale membership is denied", () => {
  it("TI-12 token without an active organization sees nothing", async () => {
    const result = await asUser(claimsFor(A.staff.userId), (q) => q("select id from public.leads"));
    expect(result.error).toBeNull();
    expect(result.rowCount).toBe(0);
    const write = await asUser(claimsFor(A.staff.userId), (q) => q("insert into public.leads (full_name) values ('x')"));
    expect(write.error).not.toBeNull();
  });

  it("TI-13 org claim for A but no membership row sees nothing", async () => {
    const result = await asUser(claimsFor("user_strangerZ9", A.orgId), (q) => q("select id from public.patients"));
    expect(result.rowCount).toBe(0);
  });

  it("TI-14 member of A presenting Clinic B's org id sees nothing", async () => {
    const result = await asUser(claimsFor(A.owner.userId, B.orgId, "admin"), (q) => q("select id from public.leads"));
    expect(result.rowCount).toBe(0);
  });

  it("TI-15 deactivated membership sees nothing even with a valid org claim", async () => {
    await admin("update public.clinic_members set status = 'removed' where id = $1", [A.viewer.memberId]);
    try {
      const result = await asUser(A.viewer.claims, (q) => q("select id from public.leads"));
      expect(result.rowCount).toBe(0);
    } finally {
      await admin("update public.clinic_members set status = 'active' where id = $1", [A.viewer.memberId]);
    }
  });

  it("archived clinic is invisible to its members", async () => {
    await admin("update public.clinics set archived_at = now() where id = $1", [B.id]);
    try {
      const result = await asUser(B.owner.claims, (q) => q("select id from public.patients"));
      expect(result.rowCount).toBe(0);
    } finally {
      await admin("update public.clinics set archived_at = null where id = $1", [B.id]);
    }
  });
});

describe("TI-16 anonymous callers see nothing", () => {
  for (const table of [...TENANT_TABLES, "billing_orders", "payments", "webhook_events", "contact_requests", "clinic_invitations"]) {
    it(`anon select ${table} is denied`, async () => {
      const result = await asRole("anon", null, (q) => q(`select * from public.${table} limit 1`));
      expect(result.error?.code).toBe("42501");
    });
  }

  it("anon cannot call member RPCs", async () => {
    const result = await asRole("anon", null, (q) => q("select * from public.my_membership()"));
    expect(result.error?.code).toBe("42501");
  });
});

describe("TI-17..TI-19 billing data is read-only and scoped", () => {
  it.each([
    ["webhook_events select", "select * from public.webhook_events"],
    [
      "webhook_events insert",
      "insert into public.webhook_events (provider, event_id, event_type, payload_sha256) values ('razorpay','evt_x','payment.captured', repeat('a',64))",
    ],
    ["entitlement update", "update public.clinic_entitlements set paid_through = now() + interval '10 years'"],
    ["entitlement insert", "insert into public.clinic_entitlements (clinic_id, paid_through) values (gen_random_uuid(), now())"],
    [
      "billing_orders insert",
      "insert into public.billing_orders (id, clinic_id, provider_order_id, plan_code, period_months, base_paise, gst_paise, amount_paise, created_by) values (gen_random_uuid(), gen_random_uuid(), 'order_x', 'p', 1, 1, 0, 1, 'x')",
    ],
    ["payments update", "update public.payments set status = 'captured'"],
  ])("%s is denied to the clinic owner", async (_name, sql) => {
    const result = await asUser(A.owner.claims, (q) => q(sql));
    expect(result.error?.code).toBe("42501");
  });

  it("TI-18 apply_verified_payment is not executable by users", async () => {
    const result = await asUser(A.owner.claims, (q) =>
      q("select public.apply_verified_payment(gen_random_uuid(), 'order_x', 'pay_x', 1, 'INR')"),
    );
    expect(result.error?.code).toBe("42501");
  });

  it("TI-19 entitlement of Clinic B is invisible to Clinic A", async () => {
    const result = await asUser(A.owner.claims, (q) =>
      q("select * from public.clinic_entitlements where clinic_id = $1", [B.id]),
    );
    expect(result.rowCount).toBe(0);
  });

  it("staff cannot read billing orders or payments", async () => {
    await admin(
      "insert into public.billing_orders (id, clinic_id, provider_order_id, plan_code, period_months, base_paise, gst_paise, amount_paise, created_by) values (gen_random_uuid(), $1, $2, 'parmarpro_clinic_monthly', 1, 7500000, 1350000, 8850000, 'system')",
      [A.id, `order_staffcheck${Date.now()}`],
    );
    const staff = await asUser(A.staff.claims, (q) => q("select * from public.billing_orders"));
    expect(staff.rowCount).toBe(0);
    const owner = await asUser(A.owner.claims, (q) => q("select * from public.billing_orders"));
    expect(owner.rowCount).toBeGreaterThan(0);
  });
});

describe("TI-20 writes require an active entitlement; reads do not", () => {
  it("expired clinic can read but not write", async () => {
    const expired = await createClinicFixture("Expired", { entitled: false });
    try {
      const read = await asUser(expired.staff.claims, (q) => q("select id from public.leads"));
      expect(read.rowCount).toBeGreaterThan(0);
      const insert = await asUser(expired.staff.claims, (q) =>
        q("insert into public.leads (full_name) values ('Blocked')"),
      );
      expect(insert.error?.code).toBe("42501");
      const update = await asUser(expired.staff.claims, (q) =>
        q("update public.leads set notes = 'blocked' where id = $1", [expired.leadId]),
      );
      expect(update.error?.code).toBe("42501");
    } finally {
      await deleteClinicFixture(expired);
    }
  });
});

describe("TI-21 activity trail is append-only for users", () => {
  it.each([
    ["insert", "insert into public.activity_events (clinic_id, actor_user_id, entity_type, action) values ($1, 'x', 'lead', 'created')"],
    ["update", "update public.activity_events set action = 'tampered' where clinic_id = $1"],
    ["delete", "delete from public.activity_events where clinic_id = $1"],
  ])("%s is denied", async (_name, sql) => {
    const result = await asUser(A.owner.claims, (q) => q(sql, [A.id]));
    expect(result.error?.code).toBe("42501");
  });

  it("changes are recorded without personal data", async () => {
    const result = await asUser(A.staff.claims, async (q) => {
      await q("update public.leads set full_name = 'Synthetic Renamed', status = 'contacted' where id = $1", [A.leadId]);
      return q<{ action: string; metadata: Record<string, unknown>; actor_user_id: string }>(
        "select action, metadata, actor_user_id from public.activity_events where entity_id = $1 order by id desc limit 1",
        [A.leadId],
      );
    });
    const event = result.rows[0]!;
    expect(event.action).toBe("updated");
    expect(event.actor_user_id).toBe(A.staff.userId);
    expect(event.metadata).toEqual({ fields: ["full_name", "status"], from: "new", to: "contacted" });
    expect(JSON.stringify(event.metadata)).not.toContain("Synthetic Renamed");
  });
});

describe("TI-22 contact form is insert-only for anonymous callers", () => {
  it("anon can submit through the RPC but not read back", async () => {
    const result = await asRole("anon", null, async (q) => {
      const submit = await q(
        "select public.submit_contact_request('Synthetic Prospect', 'Synthetic Dental', '+919800000002', null, 'Mumbai', 'Interested')",
      );
      const read = await q("select * from public.contact_requests");
      const direct = await q("insert into public.contact_requests (full_name, email) values ('x', 'x@example.com')");
      return { submit, read, direct };
    });
    expect(result.submit.error).toBeNull();
    expect(result.read.error?.code).toBe("42501");
    expect(result.direct.error?.code).toBe("42501");
  });
});

describe("TI-23 clinic creation is restricted to the org admin, once", () => {
  it("org member (not admin) cannot create the clinic", async () => {
    const result = await asUser(claimsFor("user_newmember1", "org_brandnew1", "member"), (q) =>
      q("select public.create_clinic_for_active_org('Synthetic Dental')"),
    );
    expect(result.error?.code).toBe("42501");
  });

  it("cannot create a second clinic for an org that already has one", async () => {
    const result = await asUser(claimsFor("user_otheradmin1", A.orgId, "admin"), (q) =>
      q("select public.create_clinic_for_active_org('Duplicate')"),
    );
    expect(result.error?.code).toBe("23505");
  });

  it("org admin creates the clinic, becomes owner and gets a trial", async () => {
    const orgId = `org_fresh${Date.now()}`;
    const userId = `user_founder${Date.now()}`;
    const result = await asUser(claimsFor(userId, orgId, "admin"), async (q) => {
      const created = await q<{ id: string }>("select public.create_clinic_for_active_org('Synthetic Fresh Dental') as id");
      const me = await q<{ role: string; entitled: boolean }>("select role, entitled from public.my_membership()");
      return { created, me };
    });
    expect(result.created.error).toBeNull();
    expect(result.me.rows[0]).toEqual({ role: "owner", entitled: true });
  });

  it("no org claim cannot create a clinic", async () => {
    const result = await asUser(claimsFor("user_noorg1"), (q) => q("select public.create_clinic_for_active_org('X')"));
    expect(result.error?.code).toBe("42501");
  });
});

describe("TI-24 switching the active organization switches the visible clinic", () => {
  it("a member of both clinics sees only the active one", async () => {
    const userId = `user_both${Date.now()}`;
    await admin("insert into public.clinic_members (clinic_id, clerk_user_id, role) values ($1, $2, 'staff'), ($3, $2, 'viewer')", [
      A.id,
      userId,
      B.id,
    ]);
    const asA = await asUser(claimsFor(userId, A.orgId), (q) => q<{ c: string }>("select distinct clinic_id::text as c from public.leads"));
    const asB = await asUser(claimsFor(userId, B.orgId), (q) => q<{ c: string }>("select distinct clinic_id::text as c from public.leads"));
    expect(asA.rows.map((r) => r.c)).toEqual([A.id]);
    expect(asB.rows.map((r) => r.c)).toEqual([B.id]);
    const roleB = await asUser(claimsFor(userId, B.orgId), (q) =>
      q("insert into public.leads (full_name) values ('viewer in B')"),
    );
    expect(roleB.error?.code).toBe("42501");
    await admin("delete from public.clinic_members where clerk_user_id = $1", [userId]);
  });
});
