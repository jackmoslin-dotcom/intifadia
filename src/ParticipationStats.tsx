export function ParticipationStats({
  data,
  privateView = false,
}: {
  data: any;
  privateView?: boolean;
}) {
  const p = data.demonstration;
  return (
    <article className="chart participation-stats">
      <span className="eyebrow">السؤال ٣٦ · نية المشاركة</span>
      <h2>النية المعلنة بشأن مظاهرة 28 أكتوبر</h2>
      <p>
        هذه إجابات طوعية تعبّر عن النية وقت تعبئة الاستبيان، وليست تسجيلاً
        رسمياً أو عدداً مؤكداً للحضور أو تقديراً ممثلاً لسكان ليبيا.
      </p>
      {p ? (
        <>
          <p>
            عدد الإجابات الصالحة لهذا السؤال:{" "}
            <strong>{p.answered.toLocaleString("ar-LY")}</strong>
          </p>
          <div className="stats">
            <article>
              <span>نعم</span>
              <strong>{p.yes.toLocaleString("ar-LY")}</strong>
              <small>
                {p.yesPercent === null ? "لا توجد إجابات" : `${p.yesPercent}٪`}
              </small>
            </article>
            <article>
              <span>لا</span>
              <strong>{p.no.toLocaleString("ar-LY")}</strong>
              <small>
                {p.noPercent === null ? "لا توجد إجابات" : `${p.noPercent}٪`}
              </small>
            </article>
          </div>
        </>
      ) : (
        <p className="empty">
          حُجبت النتائج حتى يتوفر عدد كافٍ من الإجابات دون كشف فئة صغيرة.
        </p>
      )}
      <small>
        مقام النسب هو إجابات «نعم/لا» الصالحة فقط؛ لا تدخل الأسئلة المتروكة أو
        الاستبيانات السابقة في المقام.{" "}
        {privateView
          ? "عرض مجمع مخوّل لا يخضع لحد العرض العام."
          : "تُحجب الأعداد والنسب معاً عندما توجد فئة صغيرة."}
      </small>
    </article>
  );
}
