import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  questions,
  sections,
  visible,
  cleanAnswers,
  answerSchema,
} from "./survey";
import "./style.css";
type Config = {
  configured: boolean;
  submissionReady: boolean;
  supabaseUrl: string;
  supabaseAnonKey: string;
  turnstileSiteKey: string;
  contactEmail: string;
};
let auth: SupabaseClient | undefined;
async function api(path: string, data?: unknown, token?: string) {
  const r = await fetch("/api/" + path, {
    method: data === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  const raw = await r.text();
  let body: any;

  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(
      `تعذر قراءة استجابة الخادم (${r.status}). حاول مجددًا.`
    );
  }

  if (!r.ok) {
    throw new Error(
      typeof body?.error === "string"
        ? body.error
        : `تعذر تنفيذ الطلب (${r.status})`
    );
  }

  return body;
}
const links = [
  ["/", "الرئيسية"],
  ["/survey", "الاستبيان"],
  ["/results", "النتائج"],
  ["/demands", "المطالب"],
  ["/about", "من نحن"],
];
function App() {
  const [path, setPath] = useState(location.pathname);
  const [config, setConfig] = useState<Config>();
  useEffect(() => {
    api("config").then((c) => {
      setConfig(c);
      if (c.configured)
        auth = createClient(c.supabaseUrl, c.supabaseAnonKey, {
          auth: { persistSession: false, detectSessionInUrl: false },
        });
    });
    const pop = () => {
      setPath(location.pathname);
      window.scrollTo(0, 0);
    };
    window.addEventListener("popstate", pop);
    const click = (e: MouseEvent) => {
      const a = (e.target as Element).closest("a");
      if (
        a &&
        a.origin === location.origin &&
        !a.download &&
        !a.hash &&
        !e.ctrlKey &&
        !e.metaKey
      ) {
        e.preventDefault();
        history.pushState({}, "", a.pathname);
        pop();
      }
    };
    document.addEventListener("click", click);
    return () => {
      window.removeEventListener("popstate", pop);
      document.removeEventListener("click", click);
    };
  }, []);
  return (
    <>
      <a className="skip" href="#main">
        انتقل إلى المحتوى
      <header>
        <a className="brand" href="/">
          <span className="emblem">☾★</span>
          <span>
            انتفاضة الوعي الشبابي<small>صوت الشباب.. من أجل ليبيا أفضل</small>
          </span>
        </a>
        <nav aria-label="التنقل الرئيسي">
          {links.map(([url, label]) => (
            <a
              key={url}
              href={url}
              aria-current={path === url ? "page" : undefined}
            >
              {label}
            </a>
          ))}
        </nav>
        <a className="button small red" href="/survey">
          شارك برأيك ↗
        </a>
      </header>
      <main id="main" key={path}>
        {path === "/" ? (
          <Home />
        ) : path === "/survey" ? (
          <Survey config={config} />
        ) : path === "/results" ? (
          <Results />
        ) : path === "/demands" ? (
          <Demands />
        ) : path.startsWith("/admin") ? (
          <Admin path={path} />
        ) : (
          <Info path={path} contactEmail={config?.contactEmail} />
        )}
      </main>
      <footer>
        <div className="brand">
          <span className="emblem">☾★</span>انتفاضة الوعي الشبابي
        </div>
        <p>وعي · مشاركة · مطالب حقيقية · تغيير إيجابي</p>
        <nav aria-label="روابط إضافية">
          {[
            ["/goals", "أهدافنا"],
            ["/methodology", "المنهجية"],
            ["/privacy", "الخصوصية"],
            ["/contact", "تواصل معنا"],
            ["/admin/login", "الإدارة"],
          ].map(([p, t]) => (
            <a href={p} key={p}>
              {t}
            </a>
          ))}
        </nav>
        <small>
          مبادرة مستقلة. المشاركة اختيارية، والنتائج تعبّر عن المشاركين فقط.
        </small>
      </footer>
    </>
  );
}
function Home() {
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">من أجل اقتصاد يستمع إلى الناس</span>
          <h1>
            صوتك يصنع
            <br />
            <span>التغيير</span>
            <i>.</i>
          </h1>
          <p>
            استبيان اقتصادي مستقل لفهم آراء المواطنين الليبيين حول ظروف المعيشة
            والخدمات الأساسية وأولويات الشباب.
          </p>
          <div className="trust">
            <span>◉ مشاركة اختيارية</span>
            <span>▥ نتائج مجمّعة</span>
            <span>♧ خصوصية مدروسة</span>
          </div>
          <div className="actions">
            <a className="button red" href="/survey">
              ابدأ الاستبيان الآن ←
            </a>
            <a className="button outline" href="/results">
              استكشف النتائج ▥
            </a>
          </div>
          <small>٣٥ سؤالاً اختيارياً · لا نطلب الاسم أو رقم الهاتف</small>
        </div>
        <div className="hero-caption">
          ليبيا تستحق أن نسمع بعضنا.
          <span>معاً نفهم الواقع، ونحدد الأولويات.</span>
        </div>
      </section>
      <section className="intro">
        <div>
          <span className="eyebrow">رأيك بداية الفهم</span>
          <h2>
            أسئلة عن حياتنا اليومية.
            <br />
            مساحة لصوتك.
          </h2>
          <p>
            من الرواتب والأسعار إلى فرص العمل والخدمات، نجمع الآراء بلغة محايدة
            وننشر نتائج مجمعة تحمي خصوصية المشاركين.
          </p>
          <a className="text-link" href="/methodology">
            تعرّف على المنهجية ←
          </a>
        </div>
        <div className="topic-grid">
          {sections.map((s, i) => (
            <a href="/survey" className="topic" key={s}>
              <b>0{i + 1}</b>
              <h3>{s}</h3>
              <span>{i === 5 ? "٥" : "٦"} أسئلة اختيارية ↗</span>
            </a>
          ))}
        </div>
      </section>
      <section className="callout">
        <div>
          <span className="eyebrow">شفافية قبل الأرقام</span>
          <h2>لا أرقام مصطنعة. لا وعود مجهولة.</h2>
          <p>
            تظهر النتائج بعد توفر عدد كافٍ من المشاركات لحماية المجموعات
            الصغيرة. كل مطلب مكتوب يمر بمراجعة قبل النشر.
          </p>
        </div>
        <a className="button outline" href="/privacy">
          كيف نحمي بياناتك؟ ←
        </a>
      </section>
    </>
  );
}
function Title({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-title">
      <span className="eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      {children}
    </div>
  );
}
function Bot({
  siteKey,
  onToken,
  version,
}: {
  siteKey: string;
  onToken: (v: string) => void;
  version: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!siteKey) return;
    let widget: string | undefined;
    let stopped = false;
    const render = () => {
      if (!stopped && ref.current && typeof (window as any).turnstile?.render === "function")
        widget = (window as any).turnstile.render(ref.current, {
          sitekey: siteKey,
          action: "survey",
          callback: onToken,
          "expired-callback": () => onToken(""),
          "error-callback": () => onToken(""),
          language: "ar",
        });
    };
    let script = document.querySelector<HTMLScriptElement>("#turnstile");
    if (!script) {
      script = document.createElement("script");
      script.id = "turnstile";
      script.src =
        "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      document.head.appendChild(script);
    }
    if ((window as any).turnstile) render();
    else script.addEventListener("load", render);
    return () => {
      stopped = true;
      script?.removeEventListener("load", render);
      if (widget) (window as any).turnstile?.remove(widget);
    };
  }, [siteKey, version]);
  return <div ref={ref} />;
}
function Survey({ config }: { config?: Config }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [consent, setConsent] = useState(false);
  const [token, setToken] = useState("");
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const requestId = useRef(crypto.randomUUID());
  const frozen = useRef<Record<string, unknown> | null>(null);
  const update = (id: string, value: unknown) => {
    const question = questions.find((q) => q.id === id)!;
    if (Array.isArray(value) && value.length > 1) {
      const last = value[value.length - 1];
      value = question.exclusiveOptions.includes(last)
        ? [last]
        : value.filter((v) => !question.exclusiveOptions.includes(v));
    }
    setAnswers((a) => cleanAnswers({ ...a, [id]: value }));
  };
  const submit = async () => {
    setError("");
    if (!consent) {
      setError("يرجى الموافقة على المشاركة أولاً.");
      return;
    }
    setBusy(true);
    try {
      frozen.current ??= cleanAnswers(answers);
      await api("submit", {
        requestId: requestId.current,
        answers: frozen.current,
        consent: true,
        botToken: token,
      });
      setDone(true);
      
    } catch (e) {
      setError((e as Error).message);
      setToken("");
      setVersion((v) => v + 1);
    } finally {
      setBusy(false);
    }
  };
  if (done) {
    return (
      <section className="thankyou-page" dir="rtl">
        <div className="thankyou-glow thankyou-glow-one" />
        <div className="thankyou-glow thankyou-glow-two" />

        <div className="thankyou-content" role="status">
          <div className="thankyou-symbol">
            <span>✓</span>
          </div>

          <div className="thankyou-kicker">
            INTIFADIA · انتفاضة الوعي الشبابي
          </div>

          <h1>
            شكرًا لأنك
            <span> شاركت بصوتك.</span>
          </h1>

          <p className="thankyou-lead">
            تم استلام إجاباتك بنجاح.
          </p>

          <p className="thankyou-description">
            كل رأي يحمل تجربة، وكل تجربة تستحق أن تُسمع.
            بمشاركتك اليوم، ساهمت في بناء صورة أوضح
            عن واقع الليبيين وتطلعاتهم نحو غدٍ أفضل.
          </p>

          <div className="thankyou-divider">
            <span>✦</span>
          </div>

          <div className="thankyou-quote">
            «التغيير يبدأ بالوعي، والوعي يبدأ بصوتك.»
          </div>

          <div className="thankyou-actions">
            <a href="/" className="thankyou-primary">
              العودة إلى الرئيسية <span>←</span>
            </a>
            <a href="/results" className="thankyou-secondary">
              استكشف النتائج <span>↗</span>
            </a>
          </div>

          <p className="thankyou-privacy">
            إجاباتك الفردية ليست معروضة للعامة.
            تُنشر النتائج المجمّعة فقط وفق ضوابط الخصوصية.
          </p>

          <div className="thankyou-bottom">
            <span>🇱🇾</span>
            <span>من أجل ليبيا تستمع إلى أبنائها</span>
          </div>
        </div>
      </section>
    );
  }
  return (
    <section className="page survey-page">
      <Title eyebrow="مساحة للاستماع" title="رأيك يهمّنا">
        <p>
          كل الأسئلة اختيارية. يمكنك تخطي أي سؤال أو إنهاء المشاركة دون إرسال.
          لا تكتب معلومات شخصية.
        </p>
      </Title>
      <div className="survey-layout">
        <aside className="steps" aria-label="أقسام الاستبيان">
          {[...sections, "مراجعة وإرسال"].map((s, i) => (
            <button
              key={s}
              className={step === i ? "active" : ""}
              disabled={busy || (!!frozen.current && i !== 6)}
              onClick={() => setStep(i)}
            >
              <b>{i + 1}</b>
              {s}
              <span>{i < step ? "✓" : ""}</span>
            </button>
          ))}
          <p>
            تُحفظ إجاباتك في ذاكرة هذه الصفحة فقط حتى الإرسال. إغلاقها أو
            تحديثها يمسح المسودة.
          </p>
        </aside>
        <div className="survey-card">
          <div className="progress-top">
            <span>الخطوة {step + 1} من ٧</span>
            <span>{Object.keys(answers).length} من ٣٥ سؤالاً أُجيب عنها</span>
          </div>
          <progress max={7} value={step + 1} aria-label="تقدم الاستبيان" />
          <h2 tabIndex={-1}>{step < 6 ? sections[step] : "مراجعة وإرسال"}</h2>
          {step < 6 ? (
            questions
              .filter((q) => q.section === step && visible(q, answers))
              .map((q) => (
                <fieldset key={q.id}>
                  <legend>
                    {q.label} <small>(اختياري)</small>
                  </legend>
                  {q.type === "text" ? (
                    <>
                      <textarea
                        aria-label={q.label}
                        rows={4}
                        maxLength={q.maxLength}
                        value={String(answers[q.id] || "")}
                        onChange={(e) => update(q.id, e.target.value)}
                      />
                      <small>
                        {String(answers[q.id] || "").length} / {q.maxLength} ·
                        يخضع للمراجعة قبل النشر
                      </small>
                    </>
                  ) : (
                    <div className="options">
                      {q.options.map((o) => {
                        const selected = q.multiple
                          ? ((answers[q.id] as string[]) || []).includes(
                              o.value,
                            )
                          : answers[q.id] === o.value;
                        return (
                          <label
                            className={selected ? "selected" : ""}
                            key={o.value}
                          >
                            <input
                              name={q.id}
                              type={q.multiple ? "checkbox" : "radio"}
                              checked={selected}
                              disabled={
                                q.multiple &&
                                !selected &&
                                ((answers[q.id] as string[]) || []).length >=
                                  q.maxSelections
                              }
                              onChange={() =>
                                update(
                                  q.id,
                                  q.multiple
                                    ? selected
                                      ? (answers[q.id] as string[]).filter(
                                          (v) => v !== o.value,
                                        )
                                      : [
                                          ...((answers[q.id] as string[]) ||
                                            []),
                                          o.value,
                                        ]
                                    : o.value,
                                )
                              }
                            />
                            {o.label}
                          </label>
                        );
                      })}
                    </div>
                  )}
                  {q.multiple && (
                    <small>
                      يمكن اختيار {q.maxSelections} إجابات كحد أقصى.
                    </small>
                  )}
                  {answers[q.id] !== undefined && (
                    <button className="clear" onClick={() => update(q.id, "")}>
                      مسح الإجابة
                    </button>
                  )}
                </fieldset>
              ))
          ) : (
            <>
              <p>
                أجبت عن {Object.keys(answers).length} سؤالاً. الأسئلة المتروكة
                لن تُخزّن كإجابات.
              </p>
              <div className="review">
                {Object.entries(answers).map(([id, v]) => {
                  const q = questions.find((q) => q.id === id)!;
                  return (
                    <div key={id}>
                      <b>{q.label}</b>
                      <p>
                        {q.type === "text"
                          ? String(v)
                          : (Array.isArray(v) ? v : [v])
                              .map(
                                (v) =>
                                  q.options.find((o) => o.value === v)?.label,
                              )
                              .join("، ")}
                      </p>
                    </div>
                  );
                })}
              </div>
              <label className="consent">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                أوافق طوعاً على معالجة هذه الإجابات وفق{" "}
                <a href="/privacy">سياسة الخصوصية</a>، وأفهم أن هذه نسخة اختبار
                مخصصة للبيانات الاصطناعية فقط.
              </label>
              <Bot
                siteKey={config?.turnstileSiteKey || ""}
                onToken={setToken}
                version={version}
              />
              {!config?.submissionReady && (
                <p className="notice">
                  الإرسال متوقف: يلزم ربط Supabase وخدمة التحقق الآلي قبل اختبار
                  الحفظ.
                </p>
              )}
              {frozen.current && (
                <p>
                  لمنع التكرار، أُقفلت الإجابات بعد محاولة الإرسال. يمكنك إعادة
                  المحاولة بنفس الطلب.
                </p>
              )}
            </>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="survey-actions">
            <button
              className="button outline"
              disabled={step === 0 || busy || !!frozen.current}
              onClick={() => setStep((s) => s - 1)}
            >
              السابق
            </button>
            {step < 6 ? (
              <button
                className="button red"
                onClick={() => {
                  if (
                    questions
                      .filter(
                        (q) =>
                          q.section === step && answers[q.id] !== undefined,
                      )
                      .every(
                        (q) => answerSchema(q).safeParse(answers[q.id]).success,
                      )
                  ) {
                    setStep((s) => s + 1);
                    window.scrollTo(0, 0);
                  }
                }}
              >
                التالي ←
              </button>
            ) : (
              <button
                className="button green"
                disabled={
                  busy || !config?.submissionReady || !token || !consent
                }
                onClick={submit}
              >
                {busy ? "جارٍ الحفظ…" : "إرسال الاستبيان ✓"}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
function useRemote(path: string) {
  const [data, setData] = useState<any>();
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    api(path)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [path]);
  return { data, error };
}
function Charts({ data }: { data: any }) {
  return (
    <>
      <div className="stats">
        <article>
          <span>المشاركات المكتملة</span>
          <strong>
            {data.total === null
              ? "غير منشور"
              : data.total.toLocaleString("ar-LY")}
          </strong>
          <small>حد النشر: {data.threshold} مشاركات على الأقل</small>
        </article>
        <article>
          <span>نشر مسؤول</span>
          <strong>بيانات مجمّعة</strong>
          <small>لا تُنشر سجلات فردية أو تركيبات ديموغرافية</small>
        </article>
      </div>
      <div className="charts">
        {questions
          .filter((q) => q.aggregate)
          .map((q) => {
            const bars = data.distributions[q.id] as
              { label: string; count: number }[] | undefined;
            const max = Math.max(...(bars || []).map((b) => b.count), 1);
            return (
              <article className="chart" key={q.id}>
                <h3>{q.label}</h3>
                {bars?.length ? (
                  bars.map((b) => (
                    <div className="bar-row" key={b.label}>
                      <div>
                        <span>{b.label}</span>
                        <b>{b.count.toLocaleString("ar-LY")}</b>
                      </div>
                      <div className="bar-track">
                        <span style={{ width: `${(100 * b.count) / max}%` }} />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="empty">
                    لا توجد بيانات كافية للنشر الآمن لهذا السؤال.
                  </p>
                )}
              </article>
            );
          })}
        <article className="chart">
          <h3>المشاركات الأسبوعية</h3>
          <p>الأسابيع المكتملة التي بلغت حد النشر فقط.</p>
          {data.weekly.length ? (
            data.weekly.map((w: any) => (
              <p key={w.week}>
                {w.week} <b>{w.count}</b>
              </p>
            ))
          ) : (
            <p className="empty">لا توجد أسابيع مكتملة قابلة للنشر بعد.</p>
          )}
        </article>
      </div>
    </>
  );
}
function Results() {
  const { data, error } = useRemote("results");
  return (
    <section className="page">
      <Title eyebrow="ما الذي تقوله المشاركات؟" title="النتائج العامة">
        <p>
          إحصاءات من قاعدة البيانات، دون أرقام تقديرية. العينة طوعية ولا تمثل
          جميع سكان ليبيا.
        </p>
      </Title>
      {error ? (
        <p className="notice" role="status">
          {error}
        </p>
      ) : data ? (
        <Charts data={data} />
      ) : (
        <p role="status">جارٍ تحميل النتائج…</p>
      )}
      <a className="text-link" href="/methodology">
        اقرأ حدود تفسير النتائج ←
      </a>
    </section>
  );
}
function Demands() {
  const { data, error } = useRemote("demands");
  return (
    <section className="page">
      <Title eyebrow="من الرأي إلى المقترح" title="المطالب الاقتصادية">
        <p>
          مطالب ومقترحات راجعها مشرف وأزال منها التفاصيل الشخصية. لا يُنشر أي نص
          تلقائياً.
        </p>
      </Title>
      {error ? (
        <p className="notice">{error}</p>
      ) : data?.length ? (
        <div className="demand-grid">
          {data.map((d: any) => (
            <article className="chart" key={d.id}>
              <span className="eyebrow">مطلب تمت مراجعته</span>
              <p>{d.text}</p>
            </article>
          ))}
        </div>
      ) : (
        <p className="empty">
          {data ? "لم تُنشر مطالب بعد." : "جارٍ التحميل…"}
        </p>
      )}
      <a href="/survey" className="button red">
        اكتب مطلبك في الاستبيان ←
      </a>
    </section>
  );
}
const content: Record<string, { title: string; parts: [string, string][] }> = {
  "/about": {
    title: "من نحن",
    parts: [
      [
        "مساحة مدنية للاستماع",
        "انتفاضة الوعي الشبابي مشروع مستقل لفهم التجارب الاقتصادية وأولويات الشباب في ليبيا. يهدف إلى جمع آراء طوعية بلغة محايدة وعرضها بطريقة مفهومة.",
      ],
      [
        "ماذا نفعل؟",
        "نجمع إجابات حول المعيشة والعمل والخدمات، ونراجع المطالب المكتوبة قبل نشرها. لا نجمع أسماء المشاركين ولا نبيع إجاباتهم.",
      ],
      [
        "حدود دورنا",
        "لسنا جهة حكومية أو جهة لتقديم المساعدات، ولا نضمن تنفيذ المطالب. هوية الجهة المسؤولة وقنوات التواصل المعتمدة يجب توثيقها قبل الإطلاق العام.",
      ],
    ],
  },
  "/goals": {
    title: "أهدافنا",
    parts: [
      [
        "فهم الواقع",
        "تحديد أبرز الضغوط الاقتصادية التي يصفها المشاركون، مع تجنب افتراض وجود تجربة واحدة مشتركة للجميع.",
      ],
      [
        "إتاحة مشاركة متكافئة",
        "استبيان عربي ملائم للهواتف، يسمح بتجاوز كل سؤال، ولا يشترط بيانات ديموغرافية.",
      ],
      [
        "تحويل الملاحظات إلى أولويات",
        "عرض المؤشرات المجمعة والمطالب المنقحة لتسهيل الحوار حول فرص العمل وتكلفة المعيشة وجودة الخدمات.",
      ],
      [
        "المساءلة والشفافية",
        "توضيح طريقة جمع البيانات وحدودها، وحماية الإجابات الفردية، وإتاحة مراجعة مستقلة قبل دعوة الجمهور.",
      ],
    ],
  },
  "/methodology": {
    title: "المنهجية وحدود النتائج",
    parts: [
      [
        "التصميم",
        "يتضمن الاستبيان ٣٥ سؤالاً موزعة على ستة أقسام: معلومات عامة، الرواتب والدخل، تكلفة المعيشة، العمل وفرص الشباب، الخدمات الأساسية، والأولويات والمطالب. كل سؤال اختياري. أسئلة تأخر الراتب والإيجار ومدة البحث عن عمل تظهر فقط عند انطباقها.",
      ],
      [
        "العينة والتفسير",
        "المشاركة طوعية عبر الإنترنت، وليست عينة احتمالية. قد يقل تمثيل من لا يملكون اتصالاً بالإنترنت. لا يجوز تعميم النتائج على سكان ليبيا، ولا تُعرض هوامش خطأ توحي بذلك.",
      ],
      [
        "الحساب",
        "يُحسب الطلب المكتمل مرة واحدة باستخدام معرف إعادة المحاولة. يمكن للشخص إرسال طلب آخر؛ منع تكرار الطلبات لا يثبت أن المشاركين أشخاص فريدون. الإحصاءات تعد الإجابات المختارة، لذلك قد يتجاوز مجموع خيارات السؤال المتعدد عدد المشاركات. الإجابات المتروكة لا تدخل عدّ الخيارات.",
      ],
      [
        "حماية الفئات الصغيرة",
        "لا ينشر إجمالي أقل من حد النشر. إذا احتوى سؤال على فئة مأهولة أصغر من الحد، تُحجب توزيعات السؤال بالكامل. لا توجد تقاطعات بين العمر والمدينة والجنس. تعرض الاتجاهات أسابيع مكتملة فقط. يظل خطر الاستدلال عبر الزمن قائماً ويستلزم مراجعة مستقلة.",
      ],
      [
        "النصوص والاختبار",
        "النصوص تمر بمراجعة بشرية وتنقيح قبل النشر. هذه النسخة للاختبار ببيانات اصطناعية فقط، ويجب مسحها قبل أي إطلاق معتمد.",
      ],
    ],
  },
  "/privacy": {
    title: "سياسة الخصوصية",
    parts: [
      [
        "الموافقة والاختيار",
        "كل سؤال اختياري. نطلب موافقتك عند الإرسال. تستطيع المغادرة قبل الإرسال؛ المسودة موجودة في ذاكرة الصفحة ولا تُحفظ محلياً. لا تستخدم بيانات حقيقية في هذه النسخة الخاصة.",
      ],
      [
        "البيانات التي نعالجها",
        "نخزّن الإجابات التي تختارها، وقت الإرسال ومعرف الطلب لمنع تكرار المحاولة. لا نطلب الاسم أو الهاتف أو البريد الإلكتروني. قد تكشف النصوص الحرة أو التركيبات النادرة الهوية؛ لذلك لا نعد بمجهولية كاملة.",
      ],
      [
        "البيانات التقنية ومزودو الخدمة",
        "يعالج الخادم عنوان الشبكة أثناء الاتصال. حد الإرسال يستخدم بصمة HMAC تتغير كل ساعة، منفصلة عن الإجابات وتُزال بعد انتهاء صلاحيتها عند الطلب التالي أو عملية التنظيف. Supabase يستضيف البيانات والمصادقة، وCloudflare Turnstile يتحقق من الطلبات الآلية. قد يحتفظ مزودو الاستضافة بسجلات تقنية وفق إعداداتهم؛ يجب مراجعة مواقع المعالجة والعقود والاحتفاظ قبل الإطلاق.",
      ],
      [
        "الوصول والنشر",
        "لا يمكن للزوار قراءة الإجابات الخام. الإحصاءات العامة مجمعة ومحجوبة عند صغر الفئات. المشرفون المخولون بالمصادقة الثنائية يراجعون النصوص فقط. المحللون يصلون إلى إحصاءات آمنة. لا يوفر هذا التطبيق تصدير الإجابات الفردية.",
      ],
      [
        "الاحتفاظ والحذف",
        "المدة الافتراضية ١٨٠ يوماً ويمكن للمالك ضبطها بين ٣٠ و٧٣٠ يوماً. الحذف يُنفّذ عبر عملية إدارية ويشمل المطالب التابعة، ولا يحدث تلقائياً دون تشغيلها دورياً. سجل العمليات يحتفظ بحد أقصى مستهدف سنة عند التنظيف. النسخ الاحتياطية قد تبقى وفق سياسة المزود؛ لا ندّعي مسحها فوراً.",
      ],
      [
        "طلبات الحقوق والتواصل",
        "قبل الإطلاق يجب نشر اسم المسؤول عن المعالجة ووسيلة تواصل موثوقة وتحديد الأساس القانوني. لا تجمع هذه النسخة وسيلة تعريف لاسترجاع إجابة بعينها؛ قد يتعذر ربط طلب حذف بشخص دون كشف بيانات إضافية. لا تستخدم المنصة حالياً لإرسال معلومات شخصية.",
      ],
    ],
  },
  "/contact": {
    title: "تواصل معنا",
    parts: [
      [
        "قناة التواصل الرسمية",
        "لم تُضبط بعد جهة تشغيل أو قناة تواصل موثقة لهذه النسخة الخاصة. يجب على مالك المشروع إضافة وسيلة معتمدة قبل الإطلاق العام. لن نعرض عنواناً غير حقيقي أو نجمع رسائل لا يمكن الرد عليها.",
      ],
      [
        "ملاحظة على الاستبيان",
        "يمكن كتابة ملاحظة غير شخصية في السؤال الأخير. تخضع للمراجعة ولا تُنشر تلقائياً. هذا المسار لا يوفر مراسلة أو رداً شخصياً.",
      ],
      [
        "الإبلاغ خلال المراجعة الخاصة",
        "أرسل ملاحظات الاختبار إلى مالك المشروع عبر قناة التنسيق المستخدمة لدعوتك. اذكر الصفحة والخطوات دون إرسال كلمات مرور أو بيانات مشاركين.",
      ],
    ],
  },
};
function Info({ path, contactEmail }: { path: string; contactEmail?: string }) {
  const c = content[path];
  return (
    <section className="page narrow">
      <Title eyebrow="معلومات المنصة" title={c?.title || "الصفحة غير موجودة"} />
      {c ? (
        c.parts.map(([h, p]) => (
          <article className="prose" key={h}>
            <h2>{h}</h2>
            <p>
              {path === "/contact" &&
              contactEmail &&
              h === "قناة التواصل الرسمية" ? (
                <>
                  للتواصل مع الجهة المشغلة:{" "}
                  <a
                    className="text-link"
                    href={`mailto:${encodeURIComponent(contactEmail)}`}
                  >
                    {contactEmail}
                  </a>
                  . لا ترسل إجابات حساسة أو كلمات مرور عبر البريد.
                </>
              ) : (
                p
              )}
            </p>
          </article>
        ))
      ) : (
        <a href="/" className="button red">
          العودة للرئيسية
        </a>
      )}
      {path === "/contact" && (
        <a href="/survey" className="button outline">
          إضافة ملاحظة في الاستبيان
        </a>
      )}
    </section>
  );
}
function Admin({ path }: { path: string }) {
  const [session, setSession] = useState<any>();
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [factor, setFactor] = useState("");
  const [qr, setQr] = useState("");
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<any>();
  const [notice, setNotice] = useState("");
  const adminCall = async (action: string, body: unknown = {}) => {
    const { data } = await auth!.auth.getSession();
    if (!data.session) throw Error("يلزم تسجيل الدخول");
    return api("admin/" + action, body, data.session.access_token);
  };
  async function prepare() {
    const { data } = await auth!.auth.getSession();
    setSession(data.session);
    if (!data.session) return;
    try {
      const r = await adminCall("session");
      setRole(r.role);
    } catch {
      const f = await auth!.auth.mfa.listFactors();
      const verified = f.data?.totp.find((f) => f.status === "verified");
      if (verified) setFactor(verified.id);
      else {
        const enrolled = f.data?.all.find(
          (f) => f.factor_type === "totp" && f.status === "unverified",
        );
        if (enrolled) await auth!.auth.mfa.unenroll({ factorId: enrolled.id });
        const { data, error } = await auth!.auth.mfa.enroll({
          factorType: "totp",
          friendlyName: "Private admin",
        });
        if (error) throw error;
        setFactor(data.id);
        setQr(data.totp.qr_code);
        setSecret(data.totp.secret);
      }
    }
  }
  useEffect(() => {
    if (auth) prepare().catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    if (!role) return;
    const action =
      path === "/admin/moderation"
        ? "demands"
        : path === "/admin/settings"
          ? "settings"
          : path === "/admin/analytics"
            ? "analytics"
            : "overview";
    adminCall(action)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [role, path]);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="page">
      <Title eyebrow="وصول مقيّد" title="لوحة الإدارة">
        <p>
          حساب مخوّل + مصادقة ثنائية. لا يمكن إنشاء صلاحية إدارية من هذه الصفحة.
        </p>
      </Title>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {!role ? (
        <div className="auth-card">
          {!session ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                  if (!auth) throw Error("يجب تهيئة Supabase أولاً");
                  const { error } = await auth.auth.signInWithPassword({
                    email,
                    password,
                  });
                  setPassword("");
                  if (error) throw Error("تعذر تسجيل الدخول");
                  await prepare();
                });
              }}
            >
              <h2>تسجيل دخول المسؤول</h2>
              <label>
                البريد الإلكتروني
                <input
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label>
                كلمة المرور
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <button disabled={busy} className="button red">
                تسجيل الدخول ←
              </button>
            </form>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                  const { error } = await auth!.auth.mfa.challengeAndVerify({
                    factorId: factor,
                    code,
                  });
                  setCode("");
                  if (error) throw Error("رمز التحقق غير صالح");
                  const r = await adminCall("session");
                  setRole(r.role);
                  setQr("");
                  setSecret("");
                });
              }}
            >
              <h2>التحقق بخطوتين</h2>
              {qr && (
                <>
                  <p>امسح الرمز بتطبيق المصادقة ثم أدخل الرمز المؤقت.</p>
                  <img
                    className="qr"
                    src={`data:image/svg+xml;utf8,${encodeURIComponent(qr)}`}
                    alt="رمز إعداد المصادقة الثنائية"
                  />
                  <details>
                    <summary>إعداد يدوي</summary>
                    <code>{secret}</code>
                  </details>
                </>
              )}
              <label>
                رمز التحقق
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </label>
              <button className="button green" disabled={busy || !factor}>
                تحقق
              </button>
              <button
                type="button"
                className="button outline"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await auth!.auth.signOut();
                    setSession(null);
                    setCode("");
                    setQr("");
                    setSecret("");
                  })
                }
              >
                تسجيل الخروج
              </button>
            </form>
          )}
        </div>
      ) : (
        <>
          <nav className="admin-nav">
            <a href="/admin">نظرة عامة</a>
            {["owner", "analyst"].includes(role) && (
              <a href="/admin/analytics">التحليلات والتصدير</a>
            )}
            {["owner", "moderator"].includes(role) && (
              <a href="/admin/moderation">مراجعة المطالب</a>
            )}
            {role === "owner" && <a href="/admin/settings">الإعدادات والحذف</a>}
            <button
              onClick={() =>
                run(async () => {
                  await auth!.auth.signOut();
                  setRole("");
                  setSession(null);
                  setData(null);
                })
              }
            >
              تسجيل الخروج
            </button>
          </nav>
          {path === "/admin/moderation" && Array.isArray(data) ? (
            data.length ? (
              <>
                {data.map((d: any) => (
                  <Moderation
                    key={d.id}
                    demand={d}
                    save={async (body) => {
                      await adminCall("moderate", body);
                      setData(await adminCall("demands"));
                    }}
                  />
                ))}
                <button
                  className="button outline"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      const more = await adminCall("demands", {
                        beforeId: data[data.length - 1].id,
                      });
                      if (more.length) setData([...data, ...more]);
                      else setNotice("لا توجد نصوص أقدم.");
                    })
                  }
                >
                  تحميل نصوص أقدم
                </button>
              </>
            ) : (
              <p className="empty">لا توجد نصوص للمراجعة.</p>
            )
          ) : path === "/admin/analytics" && data?.distributions ? (
            <>
              <button
                className="button outline"
                onClick={() =>
                  run(async () => {
                    const { data } = await auth!.auth.getSession();
                    const r = await fetch("/api/admin/export", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${data.session!.access_token}`,
                      },
                      body: "{}",
                    });
                    if (!r.ok) throw Error("تعذر التصدير");
                    const url = URL.createObjectURL(await r.blob());
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "aggregate-statistics.csv";
                    a.click();
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                  })
                }
              >
                تصدير CSV مجمع
              </button>
              <Charts data={data} />
            </>
          ) : path === "/admin/settings" && data?.retention_days ? (
            <Settings data={data} call={adminCall} onNotice={setNotice} />
          ) : (
            <div className="chart">
              <h2>جلسة إدارية محمية</h2>
              <p>
                الصلاحية الحالية: {role}. اختر القسم المطلوب من قائمة الإدارة.
                يُفرض التحقق من الصلاحية والمصادقة الثنائية داخل قاعدة البيانات
                لكل عملية.
              </p>
              <div className="stats">
                {data?.statistics && (
                  <article>
                    <span>المشاركات القابلة للنشر</span>
                    <strong>{data.statistics.total ?? "دون حد النشر"}</strong>
                    <small>الحد الأدنى: {data.statistics.threshold}</small>
                  </article>
                )}
                {data?.moderation && (
                  <>
                    <article>
                      <span>بانتظار المراجعة</span>
                      <strong>{data.moderation.pending}</strong>
                    </article>
                    <article>
                      <span>نصوص معتمدة</span>
                      <strong>{data.moderation.approved}</strong>
                    </article>
                    <article>
                      <span>نصوص مرفوضة</span>
                      <strong>{data.moderation.rejected}</strong>
                    </article>
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
function Moderation({
  demand: d,
  save,
}: {
  demand: any;
  save: (body: any) => Promise<void>;
}) {
  const [text, setText] = useState(d.safe_text || "");
  const [reviewed, setReviewed] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(status: string) {
    setBusy(true);
    setError("");
    try {
      await save({ id: d.id, status, safeText: text, reviewed });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="chart moderation">
      <h3>
        نص #{d.id} · {d.status}
      </h3>
      <p className="private-text">{d.original_text}</p>
      <label>
        النسخة الآمنة للنشر
        <textarea
          maxLength={1000}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setReviewed(false);
          }}
        />
      </label>
      <label className="consent">
        <input
          type="checkbox"
          checked={reviewed}
          onChange={(e) => setReviewed(e.target.checked)}
        />
        راجعت النص وأزلت الأسماء وبيانات الاتصال والتفاصيل التي قد تكشف الهوية.
      </label>
      <div className="actions">
        <button
          className="button green"
          disabled={busy || !reviewed || !text.trim()}
          onClick={() => submit("approved")}
        >
          اعتماد النسخة المنقحة
        </button>
        <button
          className="button outline"
          disabled={busy}
          onClick={() => submit("rejected")}
        >
          رفض / سحب النشر
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
    </article>
  );
}
function Settings({
  data,
  call,
  onNotice,
}: {
  data: any;
  call: (action: string, body?: unknown) => Promise<any>;
  onNotice: (s: string) => void;
}) {
  const [days, setDays] = useState(data.retention_days);
  const [threshold, setThreshold] = useState(data.suppression_threshold);
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [audit, setAudit] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="chart">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(async () => {
            await call("save_settings", { retentionDays: days, threshold });
            onNotice("حُفظت الإعدادات");
          });
        }}
      >
        <label>
          الاحتفاظ بالأيام (٣٠–٧٣٠)
          <input
            type="number"
            min={30}
            max={730}
            required
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          />
        </label>
        <label>
          حد نشر المجموعة (٥–٥٠)
          <input
            type="number"
            min={5}
            max={50}
            required
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
          />
        </label>
        <button className="button green" disabled={busy}>
          حفظ الإعدادات
        </button>
      </form>
      <hr />
      <h2>حذف البيانات المنتهية</h2>
      <p>
        يحذف الإجابات التي تجاوزت المدة والمطالب التابعة لها. النسخ الاحتياطية
        تخضع لسياسة المزود. العملية غير قابلة للتراجع داخل التطبيق.
      </p>
      <label>
        اكتب DELETE EXPIRED للتأكيد
        <input
          dir="ltr"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </label>
      <button
        className="button red"
        disabled={busy || confirm !== "DELETE EXPIRED"}
        onClick={() =>
          run(async () => {
            const r = await call("delete_expired", { confirmation: confirm });
            setConfirm("");
            onNotice(`تم حذف ${r.deleted} مشاركة منتهية.`);
          })
        }
      >
        حذف البيانات المنتهية
      </button>
      <hr />
      <button
        className="button outline"
        disabled={busy}
        onClick={() => run(async () => setAudit(await call("audit")))}
      >
        عرض سجل العمليات
      </button>
      {audit.map((a) => (
        <p key={a.id}>
          {a.created_at} · {a.action} · {a.target || "—"}
        </p>
      ))}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
