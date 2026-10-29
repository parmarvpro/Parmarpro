/**
 * Automations, phase 1 (database layer): per-clinic settings and their grants,
 * the no-show and round-robin triggers, the scheduled SQL jobs and the
 * service-role query functions. Runs against the real migrations.
 */
import { randomBytes } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  admin,
  asRole,
  asUser,
  claimsFor,
  closePool,
  createClinicFixture,
  deleteClinicFixture,
  getPool,
  type ClinicFixture,
  type Persona,
  type Query,
} from "../helpers/db";

const HEX_64 = /^[0-9a-f]{64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const suffix = () => randomBytes(8).toString("hex");

let A: ClinicFixture;
let B: ClinicFixture;
let C: ClinicFixture | undefined;

beforeAll(async () => {
  A = await createClinicFixture("autoa");
  B = await createClinicFixture("autob");
});

afterAll(async () => {
  await deleteClinicFixture(C);
  await deleteClinicFixture(B);
  await deleteClinicFixture(A);
  await closePool();
});

type AutoTaskRow = { lead_id: string; assigned_to: string | null; title: string; status: string };

type DigestRow = {
  clinic_id: string;
  clinic_name: string;
  member_id: string;
  clerk_user_id: string;
  member_role: string;
  tasks_due_today: number;
  tasks_overdue: number;
  follow_ups_due_today: number;
  follow_ups_overdue: number;
  appointments_today: number;
  unassigned_open_tasks: number;
  unassigned_follow_ups: number;
};

/**
 * Inserts one row and keeps the created_at it was given. The audit trigger
 * stamps created_at = now() on every insert, so triggers are switched off for
 * this one transaction only (session_replication_role, local to the
 * transaction and reset at commit). Test fixtures only.
 */
async function insertBackdated(sql: string, params: unknown[]) {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query("set local session_replication_role = replica");
    const { rows } = await client.query<{ id: string }>(sql, params);
    await client.query("commit");
    return rows;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

/** In one rolled-back transaction: the persona opts out of the digest, then the service role lists it. */
async function optOutThenListDigest(persona: Persona): Promise<DigestRow[]> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query("set local role authenticated");
    await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(persona.claims)]);
    await client.query("select public.set_my_digest_opt_out(true)");
    await client.query("set local role service_role");
    const { rows } = await client.query<DigestRow>("select * from public.job_staff_digest(now())");
    return rows;
  } finally {
    await client.query("rollback");
    client.release();
  }
}

describe("AU-01 every clinic gets a settings row with the documented defaults", () => {
  it("the fixture clinic's settings row has the defaults", async () => {
    const { rows } = await admin(
      `select morning_digest, weekly_summary, untouched_lead_tasks, untouched_lead_hours, no_show_tasks,
              round_robin, round_robin_last_member, recall_tasks, recall_months, patient_email_reminders,
              enquiry_form_enabled, enquiry_form_key
         from public.clinic_automation_settings where clinic_id = $1`,
      [A.id],
    );
    expect(rows).toEqual([
      {
        morning_digest: true,
        weekly_summary: true,
        untouched_lead_tasks: true,
        untouched_lead_hours: 48,
        no_show_tasks: true,
        round_robin: false,
        round_robin_last_member: null,
        recall_tasks: false,
        recall_months: 6,
        patient_email_reminders: false,
        enquiry_form_enabled: false,
        enquiry_form_key: null,
      },
    ]);
  });
});

describe("AU-01b a settings row stays with its clinic", () => {
  it("clinic_id cannot be moved to another clinic", async () => {
    await expect(
      admin("update public.clinic_automation_settings set clinic_id = $1 where clinic_id = $2", [B.id, A.id]),
    ).rejects.toMatchObject({ code: "42501" });
  });
});

describe("AU-02 settings are readable by the clinic and writable by owners and admins only", () => {
  it("owner can update the clinic's morning digest toggle", async () => {
    const result = await asUser(A.owner.claims, (q) =>
      q("update public.clinic_automation_settings set morning_digest = false where clinic_id = $1", [A.id]),
    );
    expect(result.error).toBeNull();
    expect(result.rowCount).toBe(1);
  });

  it.each(["staff", "viewer"] as const)("%s cannot update the settings (zero rows, no error)", async (role) => {
    const persona = role === "staff" ? A.staff : A.viewer;
    const result = await asUser(persona.claims, (q) =>
      q("update public.clinic_automation_settings set morning_digest = false where clinic_id = $1", [A.id]),
    );
    expect(result.error).toBeNull();
    expect(result.rowCount).toBe(0);
  });

  it("owner of clinic A cannot read or update clinic B's settings", async () => {
    const result = await asUser(A.owner.claims, async (q) => {
      const read = await q("select clinic_id from public.clinic_automation_settings where clinic_id = $1", [B.id]);
      const write = await q(
        "update public.clinic_automation_settings set weekly_summary = false where clinic_id = $1",
        [B.id],
      );
      return { read, write };
    });
    expect(result.read.rows).toHaveLength(0);
    expect(result.write.error).toBeNull();
    expect(result.write.rowCount).toBe(0);
  });

  it("owner cannot set enquiry_form_key or round_robin_last_member directly (no column grant)", async () => {
    const result = await asUser(A.owner.claims, async (q) => {
      const key = await q(
        "update public.clinic_automation_settings set enquiry_form_key = $1 where clinic_id = $2",
        ["a".repeat(64), A.id],
      );
      const cursor = await q(
        "update public.clinic_automation_settings set round_robin_last_member = $1 where clinic_id = $2",
        [A.owner.memberId, A.id],
      );
      return { key, cursor };
    });
    expect(result.key.error?.code).toBe("42501");
    expect(result.cursor.error?.code).toBe("42501");
  });
});

describe("AU-02b the enquiry form key is rotated by owners and admins", () => {
  it("owner gets a 64-hex key and it is stored on the clinic", async () => {
    const result = await asUser(A.owner.claims, async (q) => {
      const regenerated = await q<{ key: string }>("select public.regenerate_enquiry_form_key() as key");
      const stored = await q<{ enquiry_form_key: string }>(
        "select enquiry_form_key from public.clinic_automation_settings where clinic_id = $1",
        [A.id],
      );
      return { regenerated, stored };
    });
    expect(result.regenerated.error).toBeNull();
    const key = result.regenerated.rows[0]!.key;
    expect(key).toMatch(HEX_64);
    expect(result.stored.rows[0]!.enquiry_form_key).toBe(key);
  });

  it.each(["staff", "viewer"] as const)("%s cannot rotate it", async (role) => {
    const persona = role === "staff" ? A.staff : A.viewer;
    const result = await asUser(persona.claims, (q) => q("select public.regenerate_enquiry_form_key()"));
    expect(result.error?.code).toBe("42501");
  });
});

describe("AU-02c members opt out of the digest for themselves", () => {
  it("a user without a membership in the token's organization cannot opt out", async () => {
    const outsider = claimsFor(`user_outsider${suffix()}`, A.orgId);
    const result = await asUser(outsider, (q) => q("select public.set_my_digest_opt_out(true)"));
    expect(result.error?.code).toBe("42501");
  });

  it("staff opting out changes only their own membership row", async () => {
    const result = await asUser(A.staff.claims, async (q) => {
      const optOut = await q("select public.set_my_digest_opt_out(true)");
      const members = await q<{ clerk_user_id: string; digest_opt_out: boolean }>(
        "select clerk_user_id, digest_opt_out from public.clinic_members where clinic_id = $1",
        [A.id],
      );
      return { optOut, members };
    });
    expect(result.optOut.error).toBeNull();
    const byUser = new Map(result.members.rows.map((r) => [r.clerk_user_id, r.digest_opt_out]));
    expect(byUser.get(A.staff.userId)).toBe(true);
    expect(byUser.get(A.owner.userId)).toBe(false);
    expect(byUser.get(A.admin.userId)).toBe(false);
    expect(byUser.get(A.viewer.userId)).toBe(false);
  });
});

describe("AU-02d automation marks on tasks cannot be set by users", () => {
  it("owner cannot insert a task with auto_kind", async () => {
    const result = await asUser(A.owner.claims, (q) =>
      q("insert into public.tasks (title, auto_kind) values ('Forged automation', 'recall')"),
    );
    expect(result.error?.code).toBe("42501");
  });

  it("owner cannot change auto_kind on an existing task", async () => {
    const result = await asUser(A.owner.claims, (q) =>
      q("update public.tasks set auto_kind = 'recall' where id = $1", [A.taskId]),
    );
    expect(result.error?.code).toBe("42501");
  });
});

describe("AU-03 untouched new leads get one follow-up task", () => {
  it("creates one task per stale lead, once, and skips leads that are scheduled, already worked or unentitled", async () => {
    const clinicC = await createClinicFixture("autoc", { entitled: false });
    C = clinicC;

    const stale = await insertBackdated(
      `insert into public.leads (clinic_id, full_name, source, status, assigned_to, created_at)
       values ($1, 'Stale Inquiry', 'website', 'new', $2, now() - interval '3 days') returning id`,
      [A.id, A.staff.memberId],
    );
    const scheduled = await insertBackdated(
      `insert into public.leads (clinic_id, full_name, source, status, next_follow_up_at, created_at)
       values ($1, 'Scheduled Callback', 'website', 'new', now() + interval '1 day', now() - interval '3 days') returning id`,
      [A.id],
    );
    const worked = await insertBackdated(
      `insert into public.leads (clinic_id, full_name, source, status, created_at)
       values ($1, 'Already Being Worked', 'website', 'new', now() - interval '3 days') returning id`,
      [A.id],
    );
    await admin("insert into public.tasks (clinic_id, title, lead_id) values ($1, 'Manual call', $2)", [
      A.id,
      worked[0]!.id,
    ]);
    const unentitled = await insertBackdated(
      `insert into public.leads (clinic_id, full_name, source, status, created_at)
       values ($1, 'Lapsed Clinic Inquiry', 'website', 'new', now() - interval '3 days') returning id`,
      [clinicC.id],
    );

    const leadIds = [stale[0]!.id, scheduled[0]!.id, worked[0]!.id, unentitled[0]!.id];
    const run = await asRole("service_role", null, async (q) => {
      const first = await q<{ n: number }>("select private.job_untouched_lead_tasks() as n");
      const afterFirst = await q<AutoTaskRow>(
        `select lead_id, assigned_to, title, status from public.tasks
          where auto_kind = 'untouched_lead' and lead_id = any($1::uuid[])`,
        [leadIds],
      );
      const second = await q<{ n: number }>("select private.job_untouched_lead_tasks() as n");
      const afterSecond = await q<AutoTaskRow>(
        `select lead_id, assigned_to, title, status from public.tasks
          where auto_kind = 'untouched_lead' and lead_id = any($1::uuid[])`,
        [leadIds],
      );
      return { first, afterFirst, second, afterSecond };
    });

    expect(run.first.error).toBeNull();
    expect(run.first.rows[0]!.n).toBeGreaterThanOrEqual(1);
    expect(run.afterFirst.rows).toEqual([
      {
        lead_id: stale[0]!.id,
        assigned_to: A.staff.memberId,
        title: "Follow up new inquiry",
        status: "open",
      },
    ]);
    expect(run.second.error).toBeNull();
    expect(run.second.rows[0]!.n).toBe(0);
    expect(run.afterSecond.rows).toEqual(run.afterFirst.rows);
  });
});

describe("AU-04 recall invitations", () => {
  it("invites a patient whose last completed visit is older than recall_months, once, and not one with a future booking", async () => {
    await admin("update public.clinic_automation_settings set recall_tasks = true where clinic_id = $1", [A.id]);
    const due = (
      await admin<{ id: string }>("insert into public.patients (clinic_id, full_name) values ($1, 'Recall Due') returning id", [
        A.id,
      ])
    ).rows[0]!;
    const booked = (
      await admin<{ id: string }>(
        "insert into public.patients (clinic_id, full_name) values ($1, 'Recall Booked') returning id",
        [A.id],
      )
    ).rows[0]!;
    for (const patientId of [due.id, booked.id]) {
      const visit = await admin<{ id: string }>(
        "insert into public.appointments (clinic_id, patient_id, starts_at) values ($1, $2, now() - interval '7 months') returning id",
        [A.id, patientId],
      );
      await admin("update public.appointments set status = 'completed' where id = $1", [visit.rows[0]!.id]);
    }
    await admin(
      "insert into public.appointments (clinic_id, patient_id, starts_at) values ($1, $2, now() + interval '5 days')",
      [A.id, booked.id],
    );

    const recallTasks = (q: Query) =>
      q<{ patient_id: string; title: string; status: string; assigned_to: string | null }>(
        `select patient_id, title, status, assigned_to from public.tasks
          where auto_kind = 'recall' and clinic_id = $1`,
        [A.id],
      );
    const run = await asRole("service_role", null, async (q) => {
      const first = await q<{ n: number }>("select private.job_recall_tasks() as n");
      const afterFirst = await recallTasks(q);
      await q("select private.job_recall_tasks()");
      const afterSecond = await recallTasks(q);
      return { first, afterFirst, afterSecond };
    });

    expect(run.first.error).toBeNull();
    expect(run.first.rows[0]!.n).toBeGreaterThanOrEqual(1);
    expect(run.afterFirst.rows).toEqual([
      {
        patient_id: due.id,
        title: "Recall due: invite for a check-up",
        status: "open",
        assigned_to: null,
      },
    ]);
    expect(run.afterSecond.rows).toEqual(run.afterFirst.rows);
  });
});

describe("AU-05 retention cleanup", () => {
  it("deletes webhook events older than 90 days and keeps the recent ones", async () => {
    const oldId = `evt_old_${suffix()}`;
    const recentId = `evt_new_${suffix()}`;
    const digest = () => randomBytes(32).toString("hex");
    await admin(
      `insert into public.webhook_events (provider, event_id, event_type, status, payload_sha256, received_at)
       values ('clerk', $1, 'user.created', 'processed', $2, now() - interval '100 days'),
              ('clerk', $3, 'user.created', 'processed', $4, now() - interval '1 day')`,
      [oldId, digest(), recentId, digest()],
    );
    try {
      const run = await asRole("service_role", null, async (q) => {
        const cleanup = await q<{ r: { webhook_events: number } }>("select private.job_cleanup() as r");
        const remaining = await q<{ event_id: string }>(
          "select event_id from public.webhook_events where event_id = any($1::text[])",
          [[oldId, recentId]],
        );
        return { cleanup, remaining };
      });
      expect(run.cleanup.error).toBeNull();
      expect(run.cleanup.rows[0]!.r.webhook_events).toBeGreaterThanOrEqual(1);
      expect(run.remaining.rows.map((r) => r.event_id)).toEqual([recentId]);
    } finally {
      await admin("delete from public.webhook_events where event_id = any($1::text[])", [[oldId, recentId]]);
    }
  });
});

describe("AU-06 morning digest", () => {
  it("counts a staff member's overdue tasks and the owner's unassigned overdue tasks", async () => {
    await admin(
      "insert into public.tasks (clinic_id, title, due_at, assigned_to) values ($1, 'Overdue for staff', now() - interval '1 day', $2)",
      [A.id, A.staff.memberId],
    );
    const result = await asRole("service_role", null, (q) =>
      q<DigestRow>("select * from public.job_staff_digest(now())"),
    );
    expect(result.error).toBeNull();

    const staffRow = result.rows.find((r) => r.member_id === A.staff.memberId);
    const ownerRow = result.rows.find((r) => r.member_id === A.owner.memberId);
    expect(staffRow?.tasks_overdue).toBeGreaterThanOrEqual(1);
    expect(staffRow?.unassigned_open_tasks).toBe(0);
    expect(ownerRow?.unassigned_open_tasks).toBeGreaterThanOrEqual(1);
    expect(result.rows.find((r) => r.member_id === A.viewer.memberId)).toBeUndefined();
  });

  it("leaves out a member who opted out, and only that member", async () => {
    const rows = await optOutThenListDigest(A.staff);
    const ids = rows.map((r) => r.member_id);
    expect(ids).not.toContain(A.staff.memberId);
    expect(ids).toContain(A.owner.memberId);
  });
});

describe("AU-07 patient email reminders", () => {
  it("reminds consenting patients about tomorrow's appointments only while the clinic setting is on", async () => {
    await admin("update public.clinic_automation_settings set patient_email_reminders = true where clinic_id = $1", [A.id]);
    const consenting = (
      await admin<{ id: string }>(
        "insert into public.patients (clinic_id, full_name, email, email_consent) values ($1, 'Ananya Rao', 'ananya.reminder@example.com', true) returning id",
        [A.id],
      )
    ).rows[0]!;
    const withoutConsent = (
      await admin<{ id: string }>(
        "insert into public.patients (clinic_id, full_name, email, email_consent) values ($1, 'Vikram Shah', 'vikram.reminder@example.com', false) returning id",
        [A.id],
      )
    ).rows[0]!;
    const tomorrowAt11 = "((date_trunc('day', now() at time zone 'Asia/Kolkata') + interval '1 day 11 hours') at time zone 'Asia/Kolkata')";
    const reminded = (
      await admin<{ id: string }>(
        `insert into public.appointments (clinic_id, patient_id, starts_at) values ($1, $2, ${tomorrowAt11}) returning id`,
        [A.id, consenting.id],
      )
    ).rows[0]!;
    const notConsenting = (
      await admin<{ id: string }>(
        `insert into public.appointments (clinic_id, patient_id, starts_at) values ($1, $2, ${tomorrowAt11}) returning id`,
        [A.id, withoutConsent.id],
      )
    ).rows[0]!;

    type Reminder = { appointment_id: string; clinic_id: string; first_name: string; email: string };
    const listReminders = () =>
      asRole("service_role", null, (q) => q<Reminder>("select * from public.job_patient_reminders(now())"));

    const on = await listReminders();
    expect(on.error).toBeNull();
    const onIds = on.rows.map((r) => r.appointment_id);
    expect(onIds).toContain(reminded.id);
    expect(onIds).not.toContain(notConsenting.id);
    expect(on.rows.find((r) => r.appointment_id === reminded.id)).toMatchObject({
      clinic_id: A.id,
      first_name: "Ananya",
      email: "ananya.reminder@example.com",
    });

    await admin("update public.clinic_automation_settings set patient_email_reminders = false where clinic_id = $1", [A.id]);
    const off = await listReminders();
    expect(off.error).toBeNull();
    expect(off.rows.map((r) => r.appointment_id)).not.toContain(reminded.id);
  });
});

describe("AU-08 trial and renewal notices", () => {
  it("a trial ending in 5 days gets a trial_reminder with 5 days left", async () => {
    await admin("update public.clinic_entitlements set trial_ends_at = now() + interval '5 days' where clinic_id = $1", [A.id]);
    const result = await asRole("service_role", null, (q) =>
      q<{ clinic_id: string; notice: string; days_left: number; period_key: string; owner_user_ids: string[] }>(
        "select * from public.job_entitlement_notices(now())",
      ),
    );
    expect(result.error).toBeNull();
    const mine = result.rows.filter((r) => r.clinic_id === A.id);
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ notice: "trial_reminder", days_left: 5, owner_user_ids: [A.owner.userId] });
    expect(mine[0]!.period_key).toMatch(/^trial_reminder:\d{4}-\d{2}-\d{2}$/);
    expect(result.rows.filter((r) => r.clinic_id === B.id)).toHaveLength(0);
  });
});

describe("AU-09 scheduled and job functions are for the service role only", () => {
  it("authenticated users and anon cannot execute the digest or the cleanup", async () => {
    const digest = await asUser(A.owner.claims, (q) => q("select * from public.job_staff_digest(now())"));
    const cleanup = await asUser(A.owner.claims, (q) => q("select private.job_cleanup()"));
    const anonDigest = await asRole("anon", null, (q) => q("select * from public.job_staff_digest(now())"));
    expect(digest.error?.code).toBe("42501");
    expect(cleanup.error?.code).toBe("42501");
    expect(anonDigest.error?.code).toBe("42501");
  });

  it("the service role can execute them", async () => {
    const result = await asRole("service_role", null, async (q) => ({
      digest: await q("select * from public.job_staff_digest(now())"),
      cleanup: await q("select private.job_cleanup()"),
    }));
    expect(result.digest.error).toBeNull();
    expect(result.cleanup.error).toBeNull();
  });
});

describe("AU-10 the marketing form returns the new request id to anonymous callers", () => {
  it("anon submission returns a uuid", async () => {
    const result = await asRole("anon", null, (q) =>
      q<{ id: string }>(
        "select public.submit_contact_request('Automation Prospect', 'Automation Dental', '+919800000003', 'prospect.automation@example.com', 'Mumbai', 'Hello') as id",
      ),
    );
    expect(result.error).toBeNull();
    expect(result.rows[0]!.id).toMatch(UUID);
  });
});

describe("AU-11 no-show callbacks", () => {
  it("a no-show with no_show_tasks on creates one callback task for tomorrow 10:00 IST, linked to the appointment", async () => {
    await admin("update public.appointments set status = 'no_show' where id = $1", [A.appointmentId]);
    const { rows } = await admin<{
      auto_kind: string;
      appointment_id: string;
      patient_id: string;
      title: string;
      status: string;
      due_time: string;
      due_in_future: boolean;
    }>(
      `select auto_kind, appointment_id, patient_id, title, status,
              to_char(due_at at time zone 'Asia/Kolkata', 'HH24:MI') as due_time,
              due_at > now() as due_in_future
         from public.tasks where appointment_id = $1`,
      [A.appointmentId],
    );
    expect(rows).toEqual([
      {
        auto_kind: "no_show_callback",
        appointment_id: A.appointmentId,
        patient_id: A.patientId,
        title: "Call back after missed appointment",
        status: "open",
        due_time: "10:00",
        due_in_future: true,
      },
    ]);
  });

  it("the callback goes to the appointment's member while that member is active", async () => {
    const { rows: inserted } = await admin<{ id: string }>(
      `insert into public.appointments (clinic_id, patient_id, starts_at, assigned_to)
       values ($1, $2, now() + interval '3 days', $3) returning id`,
      [A.id, A.patientId, A.staff.memberId],
    );
    await admin("update public.appointments set status = 'no_show' where id = $1", [inserted[0]!.id]);
    const { rows } = await admin<{ assigned_to: string | null }>(
      "select assigned_to from public.tasks where appointment_id = $1 and auto_kind = 'no_show_callback'",
      [inserted[0]!.id],
    );
    expect(rows).toEqual([{ assigned_to: A.staff.memberId }]);
  });

  it("with no_show_tasks off (clinic B), a no-show creates nothing", async () => {
    await admin("update public.clinic_automation_settings set no_show_tasks = false where clinic_id = $1", [B.id]);
    await admin("update public.appointments set status = 'no_show' where id = $1", [B.appointmentId]);
    const { rowCount } = await admin("select 1 from public.tasks where appointment_id = $1", [B.appointmentId]);
    expect(rowCount).toBe(0);
  });
});

describe("AU-12 round-robin lead assignment", () => {
  it("with round_robin on, unassigned leads cycle over the active owner, admin and staff members", async () => {
    await admin("update public.clinic_automation_settings set round_robin = true where clinic_id = $1", [A.id]);
    const assigned: (string | null)[] = [];
    for (const name of ["Round Robin 1", "Round Robin 2", "Round Robin 3"]) {
      const { rows } = await admin<{ assigned_to: string | null }>(
        "insert into public.leads (clinic_id, full_name, source) values ($1, $2, 'website') returning assigned_to",
        [A.id, name],
      );
      assigned.push(rows[0]!.assigned_to);
    }
    const candidates = [A.owner.memberId, A.admin.memberId, A.staff.memberId];
    expect(new Set(assigned)).toEqual(new Set(candidates));

    const { rows: cursor } = await admin<{ round_robin_last_member: string }>(
      "select round_robin_last_member from public.clinic_automation_settings where clinic_id = $1",
      [A.id],
    );
    expect(cursor[0]!.round_robin_last_member).toBe(assigned[2]);
  });

  it("a lead inserted with an explicit assignee keeps it", async () => {
    const { rows } = await admin<{ assigned_to: string }>(
      "insert into public.leads (clinic_id, full_name, source, assigned_to) values ($1, 'Explicit Owner', 'website', $2) returning assigned_to",
      [A.id, A.admin.memberId],
    );
    expect(rows[0]!.assigned_to).toBe(A.admin.memberId);
  });

  it("with round_robin off (clinic B), an unassigned lead stays unassigned", async () => {
    const { rows } = await admin<{ assigned_to: string | null }>(
      "insert into public.leads (clinic_id, full_name, source) values ($1, 'Unrouted', 'website') returning assigned_to",
      [B.id],
    );
    expect(rows[0]!.assigned_to).toBeNull();
  });
});

describe("AU-13 the notification log is for the service role only", () => {
  it("users cannot read it, the service role can write it", async () => {
    const read = await asUser(A.owner.claims, (q) => q("select * from public.notification_log"));
    expect(read.error?.code).toBe("42501");
    const write = await asRole("service_role", null, (q) =>
      q("insert into public.notification_log (kind, subject_key, period_key) values ('trial_reminder', 'clinic-x', '2026-11-03')"),
    );
    expect(write.error).toBeNull();
  });
});

describe("AU-14 weekly summary and founder metrics", () => {
  it("the weekly summary covers the owner's clinic and uses the dashboard keys", async () => {
    const result = await asRole("service_role", null, (q) =>
      q<{ clinic_id: string; owner_user_ids: string[]; summary: Record<string, unknown> }>(
        "select clinic_id, owner_user_ids, summary from public.job_weekly_summary(now() - interval '7 days', now())",
      ),
    );
    expect(result.error).toBeNull();
    const mine = result.rows.find((r) => r.clinic_id === A.id);
    expect(mine?.owner_user_ids).toEqual([A.owner.userId]);
    expect(Object.keys(mine?.summary ?? {}).sort()).toEqual(
      [
        "appointments_by_status",
        "appointments_in_range",
        "follow_ups_due",
        "leads_by_status",
        "leads_converted",
        "leads_created",
        "patients_total",
        "tasks_completed",
        "tasks_overdue",
      ].sort(),
    );
    const { rows } = await admin<{ n: string }>(
      "select count(*)::text as n from public.patients where clinic_id = $1 and archived_at is null",
      [A.id],
    );
    expect(mine?.summary.patients_total).toBe(Number(rows[0]!.n));
  });

  it("founder metrics return the six counters", async () => {
    const result = await asRole("service_role", null, (q) =>
      q<{ m: Record<string, number> }>("select public.job_founder_metrics(now() - interval '30 days', now()) as m"),
    );
    expect(result.error).toBeNull();
    expect(Object.keys(result.rows[0]!.m).sort()).toEqual(
      ["clinics_created", "enquiries", "paid_active", "payments_captured", "revenue_paise", "trials_active"].sort(),
    );
  });
});
