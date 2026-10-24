import { describe, it, expect } from "vitest";
import {
  questions,
  sections,
  answersSchema,
  answerSchema,
  submissionSchema,
  visible,
  cleanAnswers,
} from "../src/survey";
describe("survey contract", () => {
  it("has exactly 36 unique optional questions in 6/6/6/6/6/6 sections", () => {
    expect(questions).toHaveLength(36);
    expect(new Set(questions.map((q) => q.id)).size).toBe(36);
    expect(
      sections.map((_, i) => questions.filter((q) => q.section === i).length),
    ).toEqual([6, 6, 6, 6, 6, 6]);
    expect(
      questions.every(
        (q) =>
          q.optional &&
          q.label.length >= 8 &&
          (q.storage === `responses.answers.${q.id}` ||
            q.id === "demonstration_intent_2026_10_28"),
      ),
    ).toBe(true);
  });
  for (const q of questions) {
    it(`${q.id}: validates real answers, omission and invalid types/options`, () => {
      const valid =
        q.type === "text"
          ? "نص اصطناعي للاختبار"
          : q.multiple
            ? [q.options[0].value]
            : q.options[0].value;
      expect(answerSchema(q).safeParse(valid).success).toBe(true);
      expect(answerSchema(q).safeParse(null).success).toBe(false);
      expect(answerSchema(q).safeParse(42).success).toBe(false);
      expect(answersSchema.safeParse({}).success).toBe(true);
      const answers = {
        ...(q.condition
          ? { [q.condition.question]: q.condition.values[0] }
          : {}),
        [q.id]: valid,
      };
      expect(answersSchema.safeParse(answers).success).toBe(true);
      if (q.type === "text") {
        expect(answerSchema(q).safeParse("x".repeat(1001)).success).toBe(false);
        expect(answerSchema(q).safeParse("  ").success).toBe(false);
      } else {
        expect(
          answerSchema(q).safeParse(q.multiple ? ["invalid"] : "invalid")
            .success,
        ).toBe(false);
      }
      if (q.multiple) {
        for (const exclusive of q.exclusiveOptions)
          expect(answerSchema(q).safeParse(["v1", exclusive]).success).toBe(
            false,
          );
        expect(
          answerSchema(q).safeParse(q.options.slice(0, 4).map((o) => o.value))
            .success,
        ).toBe(false);
        expect(answerSchema(q).safeParse(["v1", "v1"]).success).toBe(false);
        expect(answerSchema(q).safeParse([]).success).toBe(false);
      }
      if (q.condition) {
        expect(visible(q, {})).toBe(false);
        expect(answersSchema.safeParse({ [q.id]: valid }).success).toBe(false);
        expect(cleanAnswers({ [q.id]: valid })).toEqual({});
      }
    });
  }
  it("rejects unknown fields, missing consent and malformed IDs", () => {
    expect(answersSchema.safeParse({ unknown: "x" }).success).toBe(false);
    expect(
      submissionSchema.safeParse({
        requestId: "x",
        answers: {},
        consent: true,
        botToken: "test",
      }).success,
    ).toBe(false);
    expect(
      submissionSchema.safeParse({
        requestId: crypto.randomUUID(),
        answers: {},
        consent: false,
        botToken: "test",
      }).success,
    ).toBe(false);
    expect(
      submissionSchema.safeParse({
        requestId: crypto.randomUUID(),
        answers: {},
        consent: true,
        botToken: "test",
        extra: 1,
      }).success,
    ).toBe(false);
  });
  it("clears stale conditional answers when parent changes", () => {
    expect(
      cleanAnswers({
        employment: "v4",
        salary_delay: "v1",
        search_duration: "v2",
        comment: "",
      }),
    ).toEqual({ employment: "v4", search_duration: "v2" });
    expect(cleanAnswers({ comment: "  \n\t" })).toEqual({});
  });
});
