export interface RawTestQuestion {
  id: string;
  questionText: string;
  questionType: string;
  optionsJson: string | null;
  correctAnswer: string | null;
  points: number;
  orderIndex: number;
}

export interface QuestionReviewItem {
  questionId: string;
  questionText: string;
  questionType: string;
  studentAnswer: string | string[] | null;
  correctAnswer: string;
  isCorrect: boolean;
  earnedPoints: number;
  maxPoints: number;
}

/**
 * Strips `isCorrect` and `correctAnswer` from a question so students cannot inspect answers before completing an attempt.
 */
export function sanitizeQuestionForClient(
  q: RawTestQuestion,
  canManage: boolean
) {
  let sanitizedOptionsJson = q.optionsJson;
  if (!canManage && q.optionsJson) {
    try {
      const parsed = JSON.parse(q.optionsJson);
      if (Array.isArray(parsed)) {
        sanitizedOptionsJson = JSON.stringify(
          parsed.map((opt) => {
            if (opt && typeof opt === "object") {
              const { isCorrect: _removed, ...rest } = opt as Record<string, unknown>;
              void _removed;
              return rest;
            }
            return opt;
          })
        );
      }
    } catch {
      // keep as is if not JSON array
    }
  }

  return {
    id: q.id,
    questionText: q.questionText,
    questionType: q.questionType,
    optionsJson: sanitizedOptionsJson,
    points: q.points,
    orderIndex: q.orderIndex,
    ...(canManage ? { correctAnswer: q.correctAnswer } : {}),
  };
}

/**
 * Evaluates a single question against a student's answer and extracts the human-readable correctAnswer.
 */
export function evaluateQuestionAnswer(
  q: RawTestQuestion,
  rawStudentVal: string | string[] | undefined | null
): {
  isCorrect: boolean;
  earnedPoints: number;
  correctAnswerDisplay: string;
} {
  let isCorrect = false;
  let correctAnswerDisplay = q.correctAnswer || "";

  let parsedOptions: Array<{
    id?: string;
    text?: string;
    isCorrect?: boolean;
  }> | null = null;

  if (q.optionsJson) {
    try {
      const parsed = JSON.parse(q.optionsJson);
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === "object") {
        parsedOptions = parsed;
      }
    } catch {
      parsedOptions = null;
    }
  }

  if (parsedOptions) {
    const correctOpts = parsedOptions.filter((o) => o.isCorrect);
    if (correctOpts.length > 0) {
      correctAnswerDisplay = correctOpts
        .map((o) => o.text || o.id || "")
        .filter(Boolean)
        .join(", ");
    }

    if (q.questionType === "SINGLE_CHOICE" || q.questionType === "TRUE_FALSE") {
      const correctOpt = parsedOptions.find((o) => o.isCorrect);
      const valStr = typeof rawStudentVal === "string" ? rawStudentVal.trim() : "";
      if (
        correctOpt &&
        valStr &&
        (valStr === correctOpt.id ||
          valStr.toLowerCase() === (correctOpt.text || "").trim().toLowerCase())
      ) {
        isCorrect = true;
      } else if (
        !correctOpt &&
        q.correctAnswer &&
        valStr.toLowerCase() === q.correctAnswer.trim().toLowerCase()
      ) {
        isCorrect = true;
      }
    } else if (q.questionType === "MULTIPLE_CHOICE") {
      const correctIds = parsedOptions
        .filter((o) => o.isCorrect)
        .map((o) => (o.id || o.text || "").trim())
        .sort();
      const selectedArr = Array.isArray(rawStudentVal)
        ? rawStudentVal.map((v) => String(v).trim()).sort()
        : typeof rawStudentVal === "string" && rawStudentVal.trim()
        ? rawStudentVal
            .split(",")
            .map((v) => v.trim())
            .sort()
        : [];
      if (
        correctIds.length > 0 &&
        correctIds.length === selectedArr.length &&
        correctIds.every((id, idx) => id === selectedArr[idx])
      ) {
        isCorrect = true;
      }
    }
  } else if (q.correctAnswer) {
    const valStr = Array.isArray(rawStudentVal)
      ? rawStudentVal.join(",").trim()
      : (rawStudentVal || "").trim();
    if (valStr.toLowerCase() === q.correctAnswer.trim().toLowerCase()) {
      isCorrect = true;
    }
  }

  return {
    isCorrect,
    earnedPoints: isCorrect ? q.points : 0,
    correctAnswerDisplay,
  };
}

/**
 * Builds the post-completion mistake review array for a completed attempt.
 */
export function buildAttemptReview(
  questions: RawTestQuestion[],
  answersJson: string | null
): QuestionReviewItem[] {
  let answersMap: Record<string, string | string[]> = {};
  if (answersJson) {
    try {
      const parsed = JSON.parse(answersJson);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        answersMap = parsed;
      }
    } catch {
      answersMap = {};
    }
  }

  return questions.map((q) => {
    const studentVal = answersMap[q.id] ?? null;
    const { isCorrect, earnedPoints, correctAnswerDisplay } = evaluateQuestionAnswer(
      q,
      studentVal
    );

    // Map option ID to readable option text if applicable
    let readableStudentAnswer: string | string[] | null = studentVal;
    if (q.optionsJson && studentVal) {
      try {
        const opts = JSON.parse(q.optionsJson);
        if (Array.isArray(opts)) {
          if (typeof studentVal === "string") {
            const found = opts.find(
              (o) => o && typeof o === "object" && o.id === studentVal
            );
            if (found?.text) readableStudentAnswer = found.text;
          } else if (Array.isArray(studentVal)) {
            readableStudentAnswer = studentVal.map((sv) => {
              const found = opts.find(
                (o) => o && typeof o === "object" && o.id === sv
              );
              return found?.text || sv;
            });
          }
        }
      } catch {
        // ignore
      }
    }

    return {
      questionId: q.id,
      questionText: q.questionText,
      questionType: q.questionType,
      studentAnswer: readableStudentAnswer,
      correctAnswer: correctAnswerDisplay,
      isCorrect,
      earnedPoints,
      maxPoints: q.points,
    };
  });
}
