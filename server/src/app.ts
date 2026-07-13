import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import ExcelJS from "exceljs";
import { z } from "zod";
import {
  authenticate,
  firebaseVerifier,
  requireProject,
  type TokenVerifier,
} from "./auth.js";
import type { Config } from "./config.js";
import type { Database } from "./db.js";
import { transaction } from "./db.js";

const uuid = z.string().uuid();
const idParams = z.object({ projectId: uuid });
const paging = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});
const projectBody = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().max(10_000).default(""),
});
const interviewBody = z.object({
  title: z.string().max(500).default(""),
  note: z.string().max(50_000).default(""),
  interview_date: z.string().date().nullable().default(null),
});
const codeBody = z.object({
  parent_id: uuid.nullable().default(null),
  name: z.string().trim().min(1).max(200),
  definition: z.string().max(50_000).default(""),
  inclusion_criteria: z.string().max(50_000).default(""),
  exclusion_criteria: z.string().max(50_000).default(""),
  color: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .default("#6366f1"),
  sort_order: z.number().int().default(0),
  status: z.enum(["active", "archived"]).default("active"),
  memo: z.string().max(100_000).default(""),
});
const caseBody = z.object({
  name: z.string().trim().min(1).max(300),
  role: z.enum(["participant", "researcher"]).default("participant"),
  aliases: z.array(z.string().trim().min(1).max(300)).max(100).default([]),
  memo: z.string().max(100_000).default(""),
});
const segmentInput = z.object({
  id: uuid.optional(),
  display_order: z.number().int().min(0),
  source_reference: z.string().max(200).nullable().optional(),
  speaker_label: z.string().trim().min(1).max(300),
  speaker_role: z.enum(["participant", "researcher"]).default("participant"),
  text: z.string().max(1_000_000),
  note: z.string().max(100_000).default(""),
  timestamp_ms: z.number().int().min(0).nullable().default(null),
});

function excerptContext(text: string, start: number, end: number) {
  return {
    before: text.slice(Math.max(0, start - 40), start),
    after: text.slice(end, end + 40),
  };
}
function findCandidate(
  text: string,
  selected: string,
  before: string,
  after: string,
) {
  const positions: number[] = [];
  let at = text.indexOf(selected);
  while (at >= 0) {
    positions.push(at);
    at = text.indexOf(selected, at + 1);
  }
  if (!positions.length) return null;
  const scored = positions.map((start) => ({
    start,
    end: start + selected.length,
    score:
      (before &&
      text.slice(Math.max(0, start - before.length), start) === before
        ? 2
        : 0) +
      (after &&
      text.slice(
        start + selected.length,
        start + selected.length + after.length,
      ) === after
        ? 2
        : 0),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.length === 1 || scored[0].score > scored[1].score
    ? scored[0]
    : null;
}
function anonymousLabel(role: string, number: number) {
  return `${role === "researcher" ? "R" : "P"}${String(number).padStart(3, "0")}`;
}

export async function buildApp(
  config: Config,
  db: Database,
  verifyToken: TokenVerifier = firebaseVerifier(config),
): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      redact: [
        "req.headers.authorization",
        "body.text",
        "body.note",
        "body.memo",
        "body.name",
      ],
    },
    bodyLimit: config.REQUEST_BODY_LIMIT,
    trustProxy: config.TRUST_PROXY,
  });
  app.addHook("onRequest", async (request, reply) => {
    if (
      config.NODE_ENV === "production" &&
      request.url !== "/health" &&
      request.headers["x-forwarded-proto"] !== "https"
    )
      return reply.code(426).send({ error: "https_required" });
  });
  await app.register(helmet);
  await app.register(rateLimit, {
    max: config.RATE_LIMIT_MAX,
    timeWindow: "1 minute",
  });
  const allowed = new Set(
    config.ALLOWED_ORIGINS.split(",").map((v) => v.trim()),
  );
  await app.register(cors, {
    origin: (origin, cb) => cb(null, !origin || allowed.has(origin)),
    credentials: false,
  });
  app.get("/health", async () => ({ ok: true }));
  const authGuard = authenticate(db, verifyToken);
  app.addHook("preHandler", async (request, reply) => {
    if (request.url.startsWith("/v1/")) return authGuard(request, reply);
  });
  app.get("/v1/me", async (req) => ({
    id: req.localUserId,
    email: req.firebaseUser.email,
    display_name: req.firebaseUser.name,
  }));

  app.get(
    "/v1/projects",
    async (req) =>
      (
        await db.query(
          "SELECT p.* FROM projects p JOIN project_members m ON m.project_id=p.id WHERE m.user_id=$1 ORDER BY p.created_at DESC",
          [req.localUserId],
        )
      ).rows,
  );
  app.post("/v1/projects", async (req, reply) => {
    const body = projectBody.parse(req.body);
    const row = await transaction(db, async (c) => {
      const p = (
        await c.query(
          "INSERT INTO projects(name,description) VALUES($1,$2) RETURNING *",
          [body.name, body.description],
        )
      ).rows[0];
      await c.query(
        "INSERT INTO project_members(project_id,user_id,role) VALUES($1,$2,'owner')",
        [p.id, req.localUserId],
      );
      return p;
    });
    return reply.code(201).send(row);
  });

  const owned = async (req: any, reply: any) => {
    const { projectId } = idParams.parse(req.params);
    if (!(await requireProject(db, req.localUserId, projectId)))
      return reply.code(404).send({ error: "not_found" });
  };
  app.patch("/v1/projects/:projectId", { preHandler: owned }, async (req) => {
    const { projectId } = idParams.parse(req.params);
    const b = projectBody.partial().parse(req.body);
    return (
      await db.query(
        "UPDATE projects SET name=COALESCE($2,name),description=COALESCE($3,description),updated_at=now() WHERE id=$1 RETURNING *",
        [projectId, b.name, b.description],
      )
    ).rows[0];
  });
  app.delete(
    "/v1/projects/:projectId",
    { preHandler: owned },
    async (req, reply) => {
      await db.query("DELETE FROM projects WHERE id=$1", [
        idParams.parse(req.params).projectId,
      ]);
      return reply.code(204).send();
    },
  );

  app.get(
    "/v1/projects/:projectId/interviews",
    { preHandler: owned },
    async (req) =>
      (
        await db.query(
          "SELECT * FROM interviews WHERE project_id=$1 ORDER BY interview_date DESC NULLS LAST,created_at DESC",
          [idParams.parse(req.params).projectId],
        )
      ).rows,
  );
  app.post(
    "/v1/projects/:projectId/interviews",
    { preHandler: owned },
    async (req, reply) => {
      const p = idParams.parse(req.params);
      const b = interviewBody.parse(req.body);
      const row = (
        await db.query(
          "INSERT INTO interviews(project_id,title,note,interview_date) VALUES($1,$2,$3,$4) RETURNING *",
          [p.projectId, b.title, b.note, b.interview_date],
        )
      ).rows[0];
      return reply.code(201).send(row);
    },
  );
  app.patch(
    "/v1/projects/:projectId/interviews/:id",
    { preHandler: owned },
    async (req) => {
      const p = z.object({ projectId: uuid, id: uuid }).parse(req.params);
      const b = interviewBody.partial().parse(req.body);
      return (
        await db.query(
          "UPDATE interviews SET title=COALESCE($3,title),note=COALESCE($4,note),interview_date=COALESCE($5,interview_date),updated_at=now() WHERE id=$1 AND project_id=$2 RETURNING *",
          [p.id, p.projectId, b.title, b.note, b.interview_date],
        )
      ).rows[0];
    },
  );
  app.delete(
    "/v1/projects/:projectId/interviews/:id",
    { preHandler: owned },
    async (req, reply) => {
      const p = z.object({ projectId: uuid, id: uuid }).parse(req.params);
      await db.query("DELETE FROM interviews WHERE id=$1 AND project_id=$2", [
        p.id,
        p.projectId,
      ]);
      return reply.code(204).send();
    },
  );

  app.get(
    "/v1/projects/:projectId/interviews/:id/segments",
    { preHandler: owned },
    async (req) => {
      const p = z.object({ projectId: uuid, id: uuid }).parse(req.params);
      const q = paging.parse(req.query);
      return (
        await db.query(
          `SELECT s.*,sp.label speaker_name,sp.role speaker_role,sp.case_id FROM segments s LEFT JOIN speakers sp ON sp.id=s.speaker_id JOIN interviews i ON i.id=s.interview_id WHERE s.interview_id=$1 AND i.project_id=$2 ORDER BY display_order LIMIT $3 OFFSET $4`,
          [p.id, p.projectId, q.limit, q.offset],
        )
      ).rows;
    },
  );
  app.put(
    "/v1/projects/:projectId/interviews/:id/segments",
    { preHandler: owned },
    async (req, reply) => {
      const p = z.object({ projectId: uuid, id: uuid }).parse(req.params);
      const rows = z.array(segmentInput).max(5000).parse(req.body);
      const result = await transaction(db, async (c) => {
        const exists = await c.query(
          "SELECT 1 FROM interviews WHERE id=$1 AND project_id=$2",
          [p.id, p.projectId],
        );
        if (!exists.rowCount) return null;
        const saved = [];
        for (const s of rows) {
          const speaker = (
            await c.query(
              `INSERT INTO speakers(interview_id,label,role) VALUES($1,$2,$3) ON CONFLICT(interview_id,label) DO UPDATE SET role=EXCLUDED.role RETURNING id`,
              [p.id, s.speaker_label, s.speaker_role],
            )
          ).rows[0];
          if (s.id) {
            const old = (
              await c.query(
                "SELECT * FROM segments WHERE id=$1 AND interview_id=$2",
                [s.id, p.id],
              )
            ).rows[0];
            if (!old) throw new Error("segment_not_found");
            if (old.text !== s.text) {
              await c.query(
                "UPDATE segments SET speaker_id=$3,display_order=$4,source_reference=$5,text=$6,note=$7,timestamp_ms=$8,text_version=text_version+1,updated_at=now() WHERE id=$1 AND interview_id=$2",
                [
                  s.id,
                  p.id,
                  speaker.id,
                  s.display_order,
                  s.source_reference,
                  s.text,
                  s.note,
                  s.timestamp_ms,
                ],
              );
              const codings = (
                await c.query(
                  "SELECT * FROM codings WHERE segment_id=$1 AND status='valid'",
                  [s.id],
                )
              ).rows;
              for (const coding of codings) {
                const unchanged =
                  s.text.slice(coding.start_offset, coding.end_offset) ===
                  coding.selected_text;
                if (unchanged) {
                  await c.query(
                    "UPDATE codings SET segment_text_version=segment_text_version+1,updated_at=now() WHERE id=$1",
                    [coding.id],
                  );
                } else {
                  const candidate = findCandidate(
                    s.text,
                    coding.selected_text,
                    coding.context_before,
                    coding.context_after,
                  );
                  await c.query(
                    "UPDATE codings SET status='needs_review',proposed_start=$2,proposed_end=$3,updated_at=now() WHERE id=$1",
                    [
                      coding.id,
                      candidate?.start ?? null,
                      candidate?.end ?? null,
                    ],
                  );
                }
              }
            } else
              await c.query(
                "UPDATE segments SET speaker_id=$3,display_order=$4,source_reference=$5,note=$6,timestamp_ms=$7,updated_at=now() WHERE id=$1 AND interview_id=$2",
                [
                  s.id,
                  p.id,
                  speaker.id,
                  s.display_order,
                  s.source_reference,
                  s.note,
                  s.timestamp_ms,
                ],
              );
            saved.push(
              (await c.query("SELECT * FROM segments WHERE id=$1", [s.id]))
                .rows[0],
            );
          } else
            saved.push(
              (
                await c.query(
                  "INSERT INTO segments(interview_id,speaker_id,display_order,source_reference,text,note,timestamp_ms) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *",
                  [
                    p.id,
                    speaker.id,
                    s.display_order,
                    s.source_reference,
                    s.text,
                    s.note,
                    s.timestamp_ms,
                  ],
                )
              ).rows[0],
            );
        }
        return saved;
      });
      if (!result) return reply.code(404).send({ error: "not_found" });
      return result;
    },
  );

  app.get(
    "/v1/projects/:projectId/codes",
    { preHandler: owned },
    async (req) =>
      (
        await db.query(
          "SELECT * FROM codes WHERE project_id=$1 ORDER BY sort_order,name",
          [idParams.parse(req.params).projectId],
        )
      ).rows,
  );
  app.post(
    "/v1/projects/:projectId/codes",
    { preHandler: owned },
    async (req, reply) => {
      const projectId = idParams.parse(req.params).projectId,
        b = codeBody.parse(req.body);
      const row = (
        await db.query(
          `INSERT INTO codes(project_id,parent_id,name,definition,inclusion_criteria,exclusion_criteria,color,sort_order,status,memo) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
          [
            projectId,
            b.parent_id,
            b.name,
            b.definition,
            b.inclusion_criteria,
            b.exclusion_criteria,
            b.color,
            b.sort_order,
            b.status,
            b.memo,
          ],
        )
      ).rows[0];
      return reply.code(201).send(row);
    },
  );
  app.patch(
    "/v1/projects/:projectId/codes/:id",
    { preHandler: owned },
    async (req) => {
      const p = z.object({ projectId: uuid, id: uuid }).parse(req.params),
        b = codeBody.partial().parse(req.body);
      const current = (
        await db.query("SELECT * FROM codes WHERE id=$1 AND project_id=$2", [
          p.id,
          p.projectId,
        ])
      ).rows[0];
      if (!current) return null;
      const v = { ...current, ...b };
      return (
        await db.query(
          `UPDATE codes SET parent_id=$3,name=$4,definition=$5,inclusion_criteria=$6,exclusion_criteria=$7,color=$8,sort_order=$9,status=$10,memo=$11,updated_at=now() WHERE id=$1 AND project_id=$2 RETURNING *`,
          [
            p.id,
            p.projectId,
            v.parent_id,
            v.name,
            v.definition,
            v.inclusion_criteria,
            v.exclusion_criteria,
            v.color,
            v.sort_order,
            v.status,
            v.memo,
          ],
        )
      ).rows[0];
    },
  );

  app.get(
    "/v1/projects/:projectId/interviews/:interviewId/codings",
    { preHandler: owned },
    async (req) => {
      const p = z
        .object({ projectId: uuid, interviewId: uuid })
        .parse(req.params);
      return (
        await db.query(
          "SELECT c.* FROM codings c JOIN segments s ON s.id=c.segment_id WHERE c.project_id=$1 AND s.interview_id=$2 ORDER BY s.display_order,c.start_offset",
          [p.projectId, p.interviewId],
        )
      ).rows;
    },
  );
  app.post(
    "/v1/projects/:projectId/codings",
    { preHandler: owned },
    async (req, reply) => {
      const projectId = idParams.parse(req.params).projectId;
      const b = z
        .object({
          segment_id: uuid,
          code_id: uuid,
          start_offset: z.number().int().min(0),
          end_offset: z.number().int().positive(),
          memo: z.string().max(100000).default(""),
        })
        .parse(req.body);
      const seg = (
        await db.query(
          "SELECT s.* FROM segments s JOIN interviews i ON i.id=s.interview_id WHERE s.id=$1 AND i.project_id=$2",
          [b.segment_id, projectId],
        )
      ).rows[0];
      if (!seg) return reply.code(404).send({ error: "not_found" });
      if (b.end_offset <= b.start_offset || b.end_offset > seg.text.length)
        return reply.code(422).send({ error: "invalid_range" });
      const selected = seg.text.slice(b.start_offset, b.end_offset);
      const ctx = excerptContext(seg.text, b.start_offset, b.end_offset);
      const row = (
        await db.query(
          `INSERT INTO codings(project_id,segment_id,code_id,start_offset,end_offset,selected_text,context_before,context_after,segment_text_version,memo) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
          [
            projectId,
            b.segment_id,
            b.code_id,
            b.start_offset,
            b.end_offset,
            selected,
            ctx.before,
            ctx.after,
            seg.text_version,
            b.memo,
          ],
        )
      ).rows[0];
      return reply.code(201).send(row);
    },
  );
  app.delete(
    "/v1/projects/:projectId/codings/:id",
    { preHandler: owned },
    async (req, reply) => {
      const p = z.object({ projectId: uuid, id: uuid }).parse(req.params);
      await db.query("DELETE FROM codings WHERE id=$1 AND project_id=$2", [
        p.id,
        p.projectId,
      ]);
      return reply.code(204).send();
    },
  );
  app.post(
    "/v1/projects/:projectId/codings/:id/reconfirm",
    { preHandler: owned },
    async (req, reply) => {
      const p = z.object({ projectId: uuid, id: uuid }).parse(req.params),
        b = z
          .object({
            start_offset: z.number().int().min(0),
            end_offset: z.number().int().positive(),
          })
          .parse(req.body);
      const row = (
        await db.query(
          "SELECT c.*,s.text,s.text_version FROM codings c JOIN segments s ON s.id=c.segment_id WHERE c.id=$1 AND c.project_id=$2",
          [p.id, p.projectId],
        )
      ).rows[0];
      if (!row) return reply.code(404).send({ error: "not_found" });
      if (row.text.slice(b.start_offset, b.end_offset) !== row.selected_text)
        return reply.code(422).send({ error: "anchor_mismatch" });
      const ctx = excerptContext(row.text, b.start_offset, b.end_offset);
      return (
        await db.query(
          "UPDATE codings SET start_offset=$3,end_offset=$4,context_before=$5,context_after=$6,segment_text_version=$7,status='valid',proposed_start=NULL,proposed_end=NULL,updated_at=now() WHERE id=$1 AND project_id=$2 RETURNING *",
          [
            p.id,
            p.projectId,
            b.start_offset,
            b.end_offset,
            ctx.before,
            ctx.after,
            row.text_version,
          ],
        )
      ).rows[0];
    },
  );

  app.get(
    "/v1/projects/:projectId/cases",
    { preHandler: owned },
    async (req) =>
      (
        await db.query(
          `SELECT c.*,COALESCE(jsonb_object_agg(d.id,v.value) FILTER(WHERE d.id IS NOT NULL),'{}') attributes FROM cases c LEFT JOIN case_attribute_values v ON v.case_id=c.id LEFT JOIN attribute_definitions d ON d.id=v.definition_id WHERE c.project_id=$1 GROUP BY c.id ORDER BY c.role,c.anonymous_number`,
          [idParams.parse(req.params).projectId],
        )
      ).rows,
  );
  app.post(
    "/v1/projects/:projectId/cases",
    { preHandler: owned },
    async (req, reply) => {
      const projectId = idParams.parse(req.params).projectId,
        b = caseBody.parse(req.body);
      const row = (
        await db.query(
          `INSERT INTO cases(project_id,name,role,aliases,memo,anonymous_number) VALUES($1,$2,$3,$4,$5,(SELECT COALESCE(max(anonymous_number),0)+1 FROM cases WHERE project_id=$1 AND role=$3)) RETURNING *`,
          [projectId, b.name, b.role, b.aliases, b.memo],
        )
      ).rows[0];
      return reply.code(201).send(row);
    },
  );
  app.patch(
    "/v1/projects/:projectId/cases/:id",
    { preHandler: owned },
    async (req) => {
      const p = z.object({ projectId: uuid, id: uuid }).parse(req.params),
        b = caseBody.partial().parse(req.body),
        cur = (
          await db.query("SELECT * FROM cases WHERE id=$1 AND project_id=$2", [
            p.id,
            p.projectId,
          ])
        ).rows[0],
        v = { ...cur, ...b };
      return (
        await db.query(
          "UPDATE cases SET name=$3,role=$4,aliases=$5,memo=$6,updated_at=now() WHERE id=$1 AND project_id=$2 RETURNING *",
          [p.id, p.projectId, v.name, v.role, v.aliases, v.memo],
        )
      ).rows[0];
    },
  );
  app.put(
    "/v1/projects/:projectId/cases/:id/attributes",
    { preHandler: owned },
    async (req, reply) => {
      const p = z.object({ projectId: uuid, id: uuid }).parse(req.params),
        b = z.record(uuid, z.unknown()).parse(req.body);
      if (
        !(
          await db.query("SELECT 1 FROM cases WHERE id=$1 AND project_id=$2", [
            p.id,
            p.projectId,
          ])
        ).rowCount
      )
        return reply.code(404).send({ error: "not_found" });
      return transaction(db, async (c) => {
        for (const [definition, value] of Object.entries(b)) {
          if (
            !(
              await c.query(
                "SELECT 1 FROM attribute_definitions WHERE id=$1 AND project_id=$2",
                [definition, p.projectId],
              )
            ).rowCount
          )
            throw new Error("attribute_not_found");
          await c.query(
            "INSERT INTO case_attribute_values(case_id,definition_id,value) VALUES($1,$2,$3) ON CONFLICT(case_id,definition_id) DO UPDATE SET value=EXCLUDED.value",
            [p.id, definition, value],
          );
        }
        return { ok: true };
      });
    },
  );
  app.get(
    "/v1/projects/:projectId/attribute-definitions",
    { preHandler: owned },
    async (req) =>
      (
        await db.query(
          "SELECT * FROM attribute_definitions WHERE project_id=$1 ORDER BY sort_order,name",
          [idParams.parse(req.params).projectId],
        )
      ).rows,
  );
  app.post(
    "/v1/projects/:projectId/attribute-definitions",
    { preHandler: owned },
    async (req, reply) => {
      const projectId = idParams.parse(req.params).projectId,
        b = z
          .object({
            name: z.string().trim().min(1),
            data_type: z.enum(["text", "number", "boolean", "date", "enum"]),
            enum_options: z.array(z.string()).default([]),
            required: z.boolean().default(false),
            sort_order: z.number().int().default(0),
          })
          .parse(req.body);
      return reply
        .code(201)
        .send(
          (
            await db.query(
              "INSERT INTO attribute_definitions(project_id,name,data_type,enum_options,required,sort_order) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",
              [
                projectId,
                b.name,
                b.data_type,
                JSON.stringify(b.enum_options),
                b.required,
                b.sort_order,
              ],
            )
          ).rows[0],
        );
    },
  );
  app.patch(
    "/v1/projects/:projectId/interviews/:interviewId/speakers/:id",
    { preHandler: owned },
    async (req, reply) => {
      const p = z
          .object({ projectId: uuid, interviewId: uuid, id: uuid })
          .parse(req.params),
        b = z.object({ case_id: uuid.nullable() }).parse(req.body);
      if (
        b.case_id &&
        !(
          await db.query("SELECT 1 FROM cases WHERE id=$1 AND project_id=$2", [
            b.case_id,
            p.projectId,
          ])
        ).rowCount
      )
        return reply.code(422).send({ error: "case_project_mismatch" });
      return (
        await db.query(
          "UPDATE speakers sp SET case_id=$4 FROM interviews i WHERE sp.id=$1 AND sp.interview_id=$2 AND i.id=sp.interview_id AND i.project_id=$3 RETURNING sp.*",
          [p.id, p.interviewId, p.projectId, b.case_id],
        )
      ).rows[0];
    },
  );

  app.get(
    "/v1/projects/:projectId/excerpts",
    { preHandler: owned },
    async (req) => {
      const projectId = idParams.parse(req.params).projectId,
        q = z
          .object({
            code_id: uuid.optional(),
            interview_id: uuid.optional(),
            case_id: uuid.optional(),
            speaker_id: uuid.optional(),
            attribute_definition_id: uuid.optional(),
            attribute_value: z.string().optional(),
          })
          .parse(req.query);
      const vals: any[] = [projectId];
      let where = "c.project_id=$1";
      for (const [column, value] of [
        ["c.code_id", q.code_id],
        ["s.interview_id", q.interview_id],
        ["sp.case_id", q.case_id],
        ["s.speaker_id", q.speaker_id],
      ])
        if (value) {
          vals.push(value);
          where += ` AND ${column}=$${vals.length}`;
        }
      if (q.attribute_definition_id) {
        vals.push(q.attribute_definition_id);
        where += ` AND EXISTS(SELECT 1 FROM case_attribute_values av WHERE av.case_id=sp.case_id AND av.definition_id=$${vals.length}`;
        if (q.attribute_value) {
          vals.push(JSON.stringify(q.attribute_value));
          where += ` AND av.value=$${vals.length}::jsonb`;
        }
        where += ")";
      }
      return (
        await db.query(
          `SELECT c.*,s.text segment_text,s.display_order,i.id interview_id,i.title interview_title,sp.label speaker_name,sp.case_id,ca.name case_name,co.name code_name FROM codings c JOIN segments s ON s.id=c.segment_id JOIN interviews i ON i.id=s.interview_id LEFT JOIN speakers sp ON sp.id=s.speaker_id LEFT JOIN cases ca ON ca.id=sp.case_id JOIN codes co ON co.id=c.code_id WHERE ${where} ORDER BY i.interview_date,s.display_order,c.start_offset`,
          vals,
        )
      ).rows;
    },
  );
  app.get(
    "/v1/projects/:projectId/matrix",
    { preHandler: owned },
    async (req) => {
      const projectId = idParams.parse(req.params).projectId,
        q = z
          .object({
            dimension: z.enum(["interview", "case"]).default("interview"),
          })
          .parse(req.query);
      const dim = q.dimension === "case" ? "ca.id" : "i.id",
        label = q.dimension === "case" ? "ca.name" : "i.title";
      return (
        await db.query(
          `SELECT co.id code_id,co.name code_name,${dim} dimension_id,${label} dimension_label,count(c.id)::int count FROM codes co LEFT JOIN codings c ON c.code_id=co.id LEFT JOIN segments s ON s.id=c.segment_id LEFT JOIN interviews i ON i.id=s.interview_id LEFT JOIN speakers sp ON sp.id=s.speaker_id LEFT JOIN cases ca ON ca.id=sp.case_id WHERE co.project_id=$1 GROUP BY co.id,co.name,${dim},${label} ORDER BY co.sort_order,dimension_label`,
          [projectId],
        )
      ).rows;
    },
  );

  async function exportData(projectId: string) {
    const project = (
      await db.query("SELECT * FROM projects WHERE id=$1", [projectId])
    ).rows[0];
    const codes = (
      await db.query(
        "SELECT * FROM codes WHERE project_id=$1 ORDER BY sort_order",
        [projectId],
      )
    ).rows;
    const cases = (
      await db.query("SELECT * FROM cases WHERE project_id=$1", [projectId])
    ).rows;
    const interviews = (
      await db.query("SELECT * FROM interviews WHERE project_id=$1", [
        projectId,
      ])
    ).rows;
    const segments = (
      await db.query(
        "SELECT s.*,sp.label speaker_name,sp.role speaker_role,sp.case_id FROM segments s JOIN interviews i ON i.id=s.interview_id LEFT JOIN speakers sp ON sp.id=s.speaker_id WHERE i.project_id=$1 ORDER BY s.display_order",
        [projectId],
      )
    ).rows;
    const codings = (
      await db.query("SELECT * FROM codings WHERE project_id=$1", [projectId])
    ).rows;
    const definitions = (
      await db.query(
        "SELECT * FROM attribute_definitions WHERE project_id=$1",
        [projectId],
      )
    ).rows;
    const values = (
      await db.query(
        "SELECT v.* FROM case_attribute_values v JOIN cases c ON c.id=v.case_id WHERE c.project_id=$1",
        [projectId],
      )
    ).rows;
    return {
      project,
      codes,
      cases,
      interviews,
      segments,
      codings,
      attribute_definitions: definitions,
      case_attribute_values: values,
    };
  }
  app.post(
    "/v1/projects/:projectId/exports/preview",
    { preHandler: owned },
    async (req) => {
      const projectId = idParams.parse(req.params).projectId,
        b = z
          .object({
            anonymize_researchers: z.boolean().default(false),
            additional_terms: z.array(z.string().min(1)).default([]),
          })
          .parse(req.body),
        data = await exportData(projectId);
      const findings = [] as any[];
      const fields = [
        ...data.interviews.map((v: any) => ({
          source: "interview_note",
          id: v.id,
          text: v.note,
        })),
        ...data.segments.flatMap((v: any) => [
          { source: "transcript", id: v.id, text: v.text },
          { source: "segment_note", id: v.id, text: v.note },
        ]),
        ...data.codes.map((v: any) => ({
          source: "code_memo",
          id: v.id,
          text: v.memo,
        })),
        ...data.codings.map((v: any) => ({
          source: "coding_memo",
          id: v.id,
          text: v.memo,
        })),
        ...data.cases.map((v: any) => ({
          source: "case_memo",
          id: v.id,
          text: v.memo,
        })),
      ];
      for (const c of data.cases) {
        if (c.role === "researcher" && !b.anonymize_researchers) continue;
        for (const term of [c.name, ...c.aliases, ...b.additional_terms])
          for (const field of fields)
            if (term && field.text?.includes(term))
              findings.push({
                source: field.source,
                source_id: field.id,
                term,
                replacement: anonymousLabel(c.role, c.anonymous_number),
                decision: "pending",
              });
      }
      return {
        mappings: data.cases
          .filter(
            (c: any) => c.role !== "researcher" || b.anonymize_researchers,
          )
          .map((c: any) => ({
            case_id: c.id,
            label: anonymousLabel(c.role, c.anonymous_number),
          })),
        findings,
        warning: "匿名化無法自動辨識所有地點、職稱與事件，匯出前仍須人工檢查。",
      };
    },
  );
  app.post(
    "/v1/projects/:projectId/exports",
    { preHandler: owned },
    async (req, reply) => {
      const projectId = idParams.parse(req.params).projectId,
        b = z
          .object({
            format: z.enum(["json", "xlsx", "csv"]),
            anonymize_researchers: z.boolean().default(false),
            redactions: z
              .array(
                z.object({
                  term: z.string().min(1),
                  replacement: z.string(),
                  decision: z.enum(["accept", "ignore"]),
                }),
              )
              .default([]),
          })
          .parse(req.body),
        data = await exportData(projectId),
        map = new Map(
          data.cases
            .filter(
              (c: any) => c.role !== "researcher" || b.anonymize_researchers,
            )
            .map((c: any) => [
              c.id,
              anonymousLabel(c.role, c.anonymous_number),
            ]),
        );
      const replace = (text: string) =>
        b.redactions
          .filter((r) => r.decision === "accept")
          .reduce(
            (out, r) => out.split(r.term).join(r.replacement),
            text || "",
          );
      const safe = {
        ...data,
        cases: data.cases.map((c: any) =>
          map.has(c.id)
            ? {
                ...c,
                name: map.get(c.id),
                aliases: [],
                memo: replace(c.memo),
                anonymous_number: undefined,
              }
            : c,
        ),
        segments: data.segments.map((s: any) => ({
          ...s,
          speaker_name: map.get(s.case_id) || s.speaker_name,
          text: replace(s.text),
          note: replace(s.note),
          case_id: undefined,
        })),
        codes: data.codes.map((c: any) => ({ ...c, memo: replace(c.memo) })),
        codings: data.codings.map((c: any) => ({
          ...c,
          selected_text: replace(c.selected_text),
          context_before: replace(c.context_before),
          context_after: replace(c.context_after),
          memo: replace(c.memo),
        })),
        interviews: data.interviews.map((i: any) => ({
          ...i,
          note: replace(i.note),
        })),
      };
      if (b.format === "json")
        return reply
          .header(
            "content-disposition",
            'attachment; filename="qualistream.json"',
          )
          .type("application/json")
          .send(safe);
      const wb = new ExcelJS.Workbook();
      for (const key of [
        "codes",
        "cases",
        "interviews",
        "segments",
        "codings",
        "attribute_definitions",
        "case_attribute_values",
      ] as const) {
        const sheet = wb.addWorksheet(key.slice(0, 31));
        const rows = safe[key] as Record<string, unknown>[];
        const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
        sheet.columns = columns.map((name) => ({
          header: name,
          key: name,
          width: Math.min(40, Math.max(12, name.length + 2)),
        }));
        for (const row of rows)
          sheet.addRow(
            Object.fromEntries(
              Object.entries(row).map(([name, value]) => [
                name,
                value && typeof value === "object"
                  ? JSON.stringify(value)
                  : value,
              ]),
            ),
          );
      }
      if (b.format === "xlsx") {
        const buf = Buffer.from(await wb.xlsx.writeBuffer());
        return reply
          .header(
            "content-disposition",
            'attachment; filename="qualistream.xlsx"',
          )
          .type(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          )
          .send(buf);
      }
      const csvRows = safe.codings.map((coding: any) => {
        const segment = safe.segments.find(
          (item: any) => item.id === coding.segment_id,
        );
        const interview = safe.interviews.find(
          (item: any) => item.id === segment?.interview_id,
        );
        const code = safe.codes.find((item: any) => item.id === coding.code_id);
        const sourceCase = data.segments.find(
          (item: any) => item.id === coding.segment_id,
        )?.case_id;
        const caseRow = safe.cases.find((item: any) => item.id === sourceCase);
        return {
          coding_id: coding.id,
          code_id: coding.code_id,
          code_name: code?.name,
          interview_id: interview?.id,
          interview_title: interview?.title,
          segment_id: segment?.id,
          display_order: segment?.display_order,
          speaker_name: segment?.speaker_name,
          case_name: caseRow?.name,
          selected_text: replace(coding.selected_text),
          start_offset: coding.start_offset,
          end_offset: coding.end_offset,
          coding_memo: coding.memo,
          status: coding.status,
        };
      });
      const headers = Object.keys(csvRows[0] || { coding_id: "" });
      const escapeCsv = (value: unknown) =>
        `"${String(value ?? "").replaceAll('"', '""')}"`;
      const csv = [
        headers.map(escapeCsv).join(","),
        ...csvRows.map((row: any) =>
          headers.map((header) => escapeCsv(row[header])).join(","),
        ),
      ].join("\r\n");
      return reply
        .header(
          "content-disposition",
          'attachment; filename="qualistream-codings.csv"',
        )
        .type("text/csv; charset=utf-8")
        .send("\ufeff" + csv);
    },
  );

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof z.ZodError)
      return reply
        .code(400)
        .send({ error: "invalid_request", issues: error.issues });
    const pgCode = (error as any).code;
    if (pgCode === "23505") return reply.code(409).send({ error: "conflict" });
    if (pgCode?.startsWith("23") || pgCode === "P0001")
      return reply.code(422).send({ error: "validation_failed" });
    request.log.error(
      { err: error instanceof Error ? error.name : "unknown" },
      "request failed",
    );
    return reply.code(500).send({ error: "internal_error" });
  });
  return app;
}
