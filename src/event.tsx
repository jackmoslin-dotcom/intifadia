export const TELEGRAM_URL = "https://t.me/LibyaYouthAwareness";
export const defaultEvent = {
  event_date: "2026-10-28",
  status: "announced",
  slogan: "لا للتخريب، نعم لليبيا الواعية",
  note: "أعلن المنظم موعد المظاهرة السلمية يوم 28 أكتوبر 2026. لم تُحدَّد في هذا الإعلان ساعة أو نقطة تجمع؛ تابع القناة الرسمية للمستجدات.",
};
export const eventStatuses: Record<string, string> = {
  proposed: "مقترح للنقاش",
  announced: "موعد معلن من المنظم",
  postponed: "أُعلن تأجيل الموعد",
  cancelled: "أُعلن إلغاء الموعد",
};
export function TelegramLink() {
  return (
    <a
      className="telegram-link"
      href={TELEGRAM_URL}
      target="_blank"
      rel="noopener noreferrer"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" width="22" height="22">
        <path
          fill="currentColor"
          d="M21.8 3.4 18.5 20c-.3 1.2-.9 1.5-1.9.9l-5-3.7-2.4 2.3c-.3.3-.5.5-1 .5l.4-5.1L18 6.4c.4-.4-.1-.6-.6-.3L5.8 13.4.9 11.9c-1.1-.3-1.1-1.1.2-1.6L20.2 3c.9-.3 1.7.2 1.6.4Z"
        />
      </svg>
      قناتنا الرسمية على تيليجرام
    </a>
  );
}
export function EventAnnouncement({
  event = defaultEvent,
}: {
  event?: typeof defaultEvent;
}) {
  return (
    <section className="event-news" aria-labelledby="event-title">
      <div className="event-date">
        <span>أكتوبر</span>
        <strong>٢٨</strong>
        <span>٢٠٢٦</span>
      </div>
      <div>
        <div className="event-meta">
          <span className="eyebrow">أخبار المبادرة</span>
          <span>{eventStatuses[event.status] || eventStatuses.proposed}</span>
        </div>
        <h2 id="event-title">
          مظاهرة سلمية — <time dateTime={event.event_date}>28 أكتوبر 2026</time>
        </h2>
        <h3>«{event.slogan}»</h3>
        <p>{event.note}</p>
        <p>
          مساحة سلمية للاستماع إلى هموم الناس وتوثيق المطالب المدنية. المشاركة
          طوعية بالكامل؛ لا مكان للعنف أو التخريب أو التهديد أو الترهيب في
          المبادرة.
        </p>
        <small>
          حالة الإعلان تصف إفادة المنظم، ولا تعني موافقة حكومية أو وجود تصريح
          رسمي.
        </small>
        <div className="actions">
          <TelegramLink />
          <a className="text-link" href="/survey">
            شارك برأيك في الاستبيان ←
          </a>
        </div>
      </div>
    </section>
  );
}
