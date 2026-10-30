import { randomBytes } from "node:crypto";

import pg from "pg";

import { loadTestEnv } from "./test-env";

export type Claims = {
  sub: string;
  role: "authenticated";
  o?: { id: string; rol: "admin" | "member" };
};

export type QueryResult<T = Record<string, unknown>> = {
  rows: T[];
  rowCount: number;
  error: (Error & { code?: string }) | null;
};

export type Query = <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<QueryResult<T>>;

let pool: pg.Pool | undefined;

export function getPool(): pg.Pool {
  if (!pool) {
    pool = new pg.Pool({ connectionString: loadTestEnv().databaseUrl, max: 4 });
  }
  return pool;
}

export async function closePool() {
  await pool?.end();
  pool = undefined;
}

/** Runs as the table-owning `postgres` role (bypasses RLS). Fixtures only. */
export async function admin<T extends pg.QueryResultRow = Record<string, unknown>>(sql: string, params: unknown[] = []) {
  return getPool().query<T>(sql, params);
}

/**
 * Runs `fn` inside a transaction as a Supabase API role with the given JWT
 * claims, exactly as PostgREST would. Every statement runs in a savepoint so
 * a rejected statement doesn't abort the rest. Always rolls back.
 */
export async function asRole<T>(
  role: "authenticated" | "anon" | "service_role",
  claims: Claims | Record<string, unknown> | null,
  fn: (q: Query) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query(`set local role ${role}`);
    if (claims) {
      await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
    }
    const q: Query = async (sql, params = []) => {
      await client.query("savepoint s");
      try {
        const result = await client.query(sql, params);
        await client.query("release savepoint s");
        return { rows: result.rows, rowCount: result.rowCount ?? 0, error: null };
      } catch (error) {
        await client.query("rollback to savepoint s");
        return { rows: [], rowCount: 0, error: error as Error & { code?: string } };
      }
    };
    return await fn(q);
  } finally {
    await client.query("rollback");
    client.release();
  }
}

export const asUser = <T>(claims: Claims | Record<string, unknown> | null, fn: (q: Query) => Promise<T>) =>
  asRole("authenticated", claims, fn);

// Fixtures -------------------------------------------------------------------

export type Persona = {
  userId: string;
  memberId: string;
  role: "owner" | "admin" | "staff" | "viewer";
  claims: Claims;
};

export type ClinicFixture = {
  id: string;
  orgId: string;
  owner: Persona;
  admin: Persona;
  staff: Persona;
  viewer: Persona;
  patientId: string;
  leadId: string;
  appointmentId: string;
  taskId: string;
};

const alnum = () => randomBytes(8).toString("hex");

export function claimsFor(userId: string, orgId?: string, rol: "admin" | "member" = "member"): Claims {
  return orgId ? { sub: userId, role: "authenticated", o: { id: orgId, rol } } : { sub: userId, role: "authenticated" };
}

export async function createClinicFixture(label: string): Promise<ClinicFixture> {
  const suffix = alnum();
  const orgId = `org_${label}${suffix}`;
  const { rows } = await admin<{ id: string }>(
    "insert into public.clinics (clerk_org_id, name) values ($1, $2) returning id",
    [orgId, `Synthetic Clinic ${label}`],
  );
  const clinicId = rows[0]!.id;

  const personas = {} as Record<Persona["role"], Persona>;
  for (const role of ["owner", "admin", "staff", "viewer"] as const) {
    const userId = `user_${role}${label}${suffix}`;
    const member = await admin<{ id: string }>(
      "insert into public.clinic_members (clinic_id, clerk_user_id, role, display_name) values ($1, $2, $3, $4) returning id",
      [clinicId, userId, role, `Synthetic ${role} ${label}`],
    );
    personas[role] = {
      userId,
      memberId: member.rows[0]!.id,
      role,
      claims: claimsFor(userId, orgId, role === "owner" ? "admin" : "member"),
    };
  }

  const patient = await admin<{ id: string }>(
    "insert into public.patients (clinic_id, full_name, phone_e164) values ($1, $2, $3) returning id",
    [clinicId, `Synthetic Patient ${label}`, "+919800000001"],
  );
  const lead = await admin<{ id: string }>(
    "insert into public.leads (clinic_id, patient_id, full_name, source, assigned_to) values ($1, $2, $3, 'whatsapp', $4) returning id",
    [clinicId, patient.rows[0]!.id, `Synthetic Lead ${label}`, personas.staff.memberId],
  );
  const appointment = await admin<{ id: string }>(
    "insert into public.appointments (clinic_id, patient_id, starts_at) values ($1, $2, now() + interval '2 days') returning id",
    [clinicId, patient.rows[0]!.id],
  );
  const task = await admin<{ id: string }>(
    "insert into public.tasks (clinic_id, title, lead_id, due_at) values ($1, $2, $3, now() - interval '1 day') returning id",
    [clinicId, `Call back ${label}`, lead.rows[0]!.id],
  );

  return {
    id: clinicId,
    orgId,
    owner: personas.owner,
    admin: personas.admin,
    staff: personas.staff,
    viewer: personas.viewer,
    patientId: patient.rows[0]!.id,
    leadId: lead.rows[0]!.id,
    appointmentId: appointment.rows[0]!.id,
    taskId: task.rows[0]!.id,
  };
}

export async function deleteClinicFixture(clinic: ClinicFixture | undefined) {
  if (!clinic) return;
  await admin("delete from public.clinics where id = $1", [clinic.id]);
}
