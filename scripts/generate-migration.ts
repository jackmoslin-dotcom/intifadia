import { writeFileSync, mkdirSync } from "node:fs";
import { questions, sections } from "../src/survey";
const sql =
  "-- Generated from src/survey.ts. Regenerate after editing question definitions.\n" +
  questions
    .map(
      (q) =>
        `insert into public.question_definitions(id,definition) values('${q.id}','${JSON.stringify(q).replaceAll("'", "''")}');`,
    )
    .join("\n") +
  "\n";
writeFileSync("supabase/migrations/002_questions.sql", sql);
mkdirSync("docs", { recursive: true });
writeFileSync(
  "docs/SURVEY.md",
  "# دليل الأسئلة الـ٣٥\n\nالنصوص مصممة وفق تفويض صاحب المشروع وتحتاج مراجعة قبل الإطلاق. لا تغيّر معرفات الأسئلة أو رموز الخيارات بعد جمع البيانات دون ترحيل إصدار الاستبيان.\n\n" +
    questions
      .map(
        (q, i) =>
          `## ${i + 1}. ${q.label}\n\n- القسم: ${sections[q.section]}\n- المعرف الثابت: \`${q.id}\`\n- النوع: ${q.type}\n- اختياري: نعم؛ الحقل المتروك يُحذف من answers، ولا يُرسل null أو نص فارغ.\n- اختيار متعدد: ${q.multiple ? "نعم" : "لا"}؛ أقصى عدد: ${q.maxSelections}\n- الخيارات: ${q.options.map((o) => `${o.value} = ${o.label}`).join("؛ ") || "نص حر"}\n- الخيارات المنفردة: ${q.exclusiveOptions.join(", ") || "لا يوجد"}\n- شرط الظهور: ${q.condition ? `${q.condition.question} ضمن ${q.condition.values.join(", ")}` : "دائماً"}\n- التخزين: \`${q.storage}\`${q.type === "text" ? " وكذلك demands.original_text، والنشر من demands.safe_text فقط." : ""}\n- التحقق: ${q.type === "text" ? "نص غير فارغ بعد إزالة الفراغات، حتى ١٠٠٠ محرف" : "الرموز المحددة حصراً؛ لا تكرار؛ لا تجاوز للعدد؛ الخيارات المنفردة لا تختلط بغيرها."} تُرفض الإجابة عن سؤال مخفي.\n- التجميع: ${q.aggregate ? `public_statistics.distributions.${q.id}، عدّ لكل خيار مع حجب الفئات الصغيرة` : "لا تجميع آلي للنص الحر؛ مراجعة بشرية قبل النشر"}\n`,
      )
      .join("\n"),
);
