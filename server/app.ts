import express from "express";
import helmet from "helmet";
import { createClient } from "@supabase/supabase-js";
import { submissionSchema } from "../src/survey";
import { aggregateCSV, rateBucket, verifyBot } from "./security";

export function createApp(env: NodeJS.ProcessEnv = process.env) {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", Number(env.TRUST_PROXY_HOPS || 0));

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            "https://challenges.cloudflare.com",
            ...(env.NODE_ENV !== "production" ? ["'unsafe-inline'"] : []),
          ],
          frameSrc: ["https://challenges.cloudflare.com"],
          connectSrc: [
            "'self'",
            ...(env.SUPABASE_URL ? [new URL(env.SUPABASE_URL).origin] : []),
            "https://challenges.cloudflare.com",
          ],
          imgSrc: ["'self'", "data:"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          upgradeInsecureRequests: env.NODE_ENV === "production" ? [] : null,
        },
      },
    }),
  );

  app.use(express.json({ limit: "24kb" }));

  app.use("/api", (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });

  const configured = !!(
    env.SUPABASE_URL &&
    env.SUPABASE_ANON_KEY &&
    env.SUPABASE_SERVICE_ROLE_KEY
  );

  const service = configured
    ? createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      })
    : null;

  const publicDb = configured
    ? createClient(env.SUPABASE_URL!, env.SUPABASE_ANON_KEY!, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      })
    : null;

  // Log only diagnostic database error fields.
  // Never log credentials, tokens or submitted answers.
  function logDatabaseError(
    operation: string,
    error: {
      code?: string;
      message?: string;
      details?: string;
      hint?: string;
    },
  ) {
    console.error(`[Intifadia] ${operation} failed`, {
      code: error.code || "unknown",
      // Database messages/details can contain submitted row values.
    });
  }

  app.get("/api/config", (_req, res) => {
    res.json({
      supabaseUrl: env.SUPABASE_URL || "",
      supabaseAnonKey: env.SUPABASE_ANON_KEY || "",
      turnstileSiteKey: env.TURNSTILE_SITE_KEY || "",
      contactEmail: env.CONTACT_EMAIL || "",
      configured,
      submissionReady:
        configured &&
        !!(
          env.TURNSTILE_SECRET_KEY &&
          env.TURNSTILE_SITE_KEY &&
          env.RATE_LIMIT_SECRET
        ),
      staging: false,
    });
  });

  app.use("/api", (req, res, next) => {
    if (req.method !== "GET" && req.get("origin") !== env.APP_ORIGIN) {
      res.status(403).json({
        error: "مصدر الطلب غير مسموح",
      });
      return;
    }

    next();
  });

  app.get("/api/event", async (_req, res) => {
    if (!publicDb) {
      res.status(503).json({ error: "تعذر تحديث الإعلان حالياً" });
      return;
    }
    const { data, error } = await publicDb.rpc("public_event");
    if (error || !data) {
      res.status(503).json({ error: "تعذر تحديث الإعلان حالياً" });
      return;
    }
    res.json(data);
  });

  // Public aggregated statistics
  app.get("/api/results", async (_req, res) => {
    if (!publicDb) {
      res.status(503).json({
        error: "قاعدة البيانات غير متصلة بعد. لا توجد إحصاءات منشورة.",
      });
      return;
    }

    try {
      const { data, error } = await publicDb.rpc("public_statistics");

      if (error) {
        logDatabaseError("public_statistics", error);

        res.status(503).json({
          error: "تعذر تحميل النتائج",
        });
        return;
      }

      if (data == null) {
        console.error("[Intifadia] public_statistics returned null");

        res.status(503).json({
          error: "النتائج غير متاحة حاليًا",
        });
        return;
      }

      res.status(200).json(data);
    } catch (error) {
      console.error(
        "[Intifadia] Unexpected results error",
        error instanceof Error ? error.message : "Unknown error",
      );

      res.status(503).json({
        error: "تعذر تحميل النتائج",
      });
    }
  });

  // Public moderated demands
  app.get("/api/demands", async (_req, res) => {
    if (!publicDb) {
      res.status(503).json({
        error: "قاعدة البيانات غير متصلة بعد.",
      });
      return;
    }

    try {
      const { data, error } = await publicDb.rpc("public_demands");

      if (error) {
        logDatabaseError("public_demands", error);

        res.status(503).json({
          error: "تعذر تحميل المطالب",
        });
        return;
      }

      res.status(200).json(data);
    } catch (error) {
      console.error(
        "[Intifadia] Unexpected demands error",
        error instanceof Error ? error.message : "Unknown error",
      );

      res.status(503).json({
        error: "تعذر تحميل المطالب",
      });
    }
  });

  // Survey submission
  app.post("/api/submit", async (req, res) => {
    const parsed = submissionSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: "يرجى مراجعة الإجابات والموافقة على سياسة المشاركة.",
      });
      return;
    }

    if (
      !service ||
      !env.TURNSTILE_SECRET_KEY ||
      !env.RATE_LIMIT_SECRET ||
      !env.APP_ORIGIN
    ) {
      res.status(503).json({
        error: "الإرسال غير متاح مؤقتاً. يرجى المحاولة لاحقاً.",
      });
      return;
    }

    try {
      const { data: allowed, error: rateError } = await service.rpc(
        "consume_rate",
        {
          p_bucket: rateBucket(req.ip || "unknown", env.RATE_LIMIT_SECRET),
        },
      );

      if (rateError) {
        logDatabaseError("consume_rate", rateError);

        res.status(503).json({
          error: "تعذر الإرسال الآن. يرجى المحاولة لاحقاً.",
        });
        return;
      }

      if (!allowed) {
        res.status(429).json({
          error: "تم تجاوز عدد المحاولات المسموح. حاول لاحقًا.",
        });
        return;
      }

      const botVerified = await verifyBot(
        parsed.data.botToken,
        env.TURNSTILE_SECRET_KEY,
        new URL(env.APP_ORIGIN).hostname,
      );

      if (!botVerified) {
        res.status(400).json({
          error: "تعذر التحقق الآلي. أعد المحاولة.",
        });
        return;
      }

      const { data, error } = await service.rpc("submit_response", {
        p_id: parsed.data.requestId,
        p_answers: parsed.data.answers,
      });

      if (error) {
        logDatabaseError("submit_response", error);

        res.status(400).json({
          error: "تعذر حفظ الإجابات. أعد المحاولة بنفس الطلب.",
        });
        return;
      }

      res.status(200).json({
        id: data,
        ok: true,
      });
    } catch (error) {
      console.error(
        "[Intifadia] Unexpected submission error",
        error instanceof Error ? error.message : "Unknown error",
      );

      res.status(503).json({
        error: "حدث خطأ أثناء الإرسال. حاول مجددًا بنفس الطلب.",
      });
    }
  });

  // Protected administration
  app.post("/api/admin/:action", async (req, res) => {
    if (!configured) {
      res.status(503).json({
        error: "خدمة الإدارة غير مهيأة",
      });
      return;
    }

    const token = req.get("authorization")?.match(/^Bearer (.+)$/)?.[1];

    if (!token) {
      res.status(401).json({
        error: "يلزم تسجيل الدخول",
      });
      return;
    }

    const db = createClient(env.SUPABASE_URL!, env.SUPABASE_ANON_KEY!, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      auth: {
        persistSession: false,
      },
    });

    const { data: user, error: authError } = await db.auth.getUser(token);

    if (authError || !user.user) {
      res.status(401).json({
        error: "جلسة غير صالحة",
      });
      return;
    }

    const { data, error } = await db.rpc("admin_action", {
      p_action: req.params.action,
      p_data: req.body ?? {},
    });

    if (error) {
      logDatabaseError("admin_action", error);

      res.status(error.code === "42501" ? 403 : 400).json({
        error:
          "العملية غير مسموحة أو البيانات غير صالحة. تحقق من الصلاحية والمصادقة الثنائية.",
      });
      return;
    }

    if (req.params.action === "export") {
      res
        .type("text/csv")
        .attachment("aggregate-statistics.csv")
        .send(aggregateCSV(data));
      return;
    }

    res.json(data);
  });

  app.use("/api", (_req, res) => {
    res.status(404).json({
      error: "المسار غير موجود",
    });
  });

  app.use(
    (
      err: any,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      console.error(
        "[Intifadia] Request processing error",
        err?.type || err?.name || "Unknown",
      );

      res.status(err?.type === "entity.too.large" ? 413 : 400).json({
        error: "تعذر معالجة الطلب",
      });
    },
  );

  return app;
}
