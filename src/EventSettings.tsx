import { useEffect, useState } from "react";
import { defaultEvent, eventStatuses } from "./event";
export function EventSettings({
  call,
}: {
  call: (action: string, body?: unknown) => Promise<any>;
}) {
  const [event, setEvent] = useState<typeof defaultEvent>();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    call("event_settings")
      .then((e) => alive && setEvent(e))
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, []);
  return (
    <section className="chart">
      <h2>إعلان المظاهرة السلمية</h2>
      <p>
        يخص هذا الإعلان موعد 28 أكتوبر 2026. حالة «معلن» تعني تأكيد المنظم فقط،
        وليست إثباتاً لترخيص حكومي. تغيير موعد الاستبيان يحتاج إصدار سؤال جديد
        للحفاظ على معنى الإجابات السابقة.
      </p>
      {event ? (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            setNotice("");
            try {
              setEvent(
                await call("save_event", {
                  status: event.status,
                  slogan: event.slogan,
                  note: event.note,
                }),
              );
              setNotice("حُفظ الإعلان وسُجّل التعديل.");
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            حالة الإعلان
            <select
              value={event.status}
              onChange={(e) => setEvent({ ...event, status: e.target.value })}
            >
              {Object.entries(eventStatuses).map(([v, t]) => (
                <option key={v} value={v}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label>
            الشعار
            <input
              required
              maxLength={200}
              value={event.slogan}
              onChange={(e) => setEvent({ ...event, slogan: e.target.value })}
            />
          </label>
          <label>
            تفاصيل الإعلان
            <textarea
              required
              maxLength={1200}
              value={event.note}
              onChange={(e) => setEvent({ ...event, note: e.target.value })}
            />
          </label>
          <button className="button green" disabled={busy}>
            حفظ الإعلان
          </button>
        </form>
      ) : (
        !error && <p role="status">جارٍ تحميل الإعدادات…</p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
