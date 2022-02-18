import { useCallback, useEffect, useState } from "react";
import { Timeline } from "metabase-types/api/timeline";
import Question from "metabase-lib/lib/Question";
import StructuredQuery from "metabase-lib/lib/queries/StructuredQuery";
import { TimelineApi } from "metabase/services";

type Status = "idle" | "loading" | "success" | "error";

type Result = {
  status: Status;
  timelines: Timeline[];
  error: unknown | null;
  isLoading: boolean;
  isError: boolean;
};

type Props = {
  question?: Question;
};

function checkShouldDisplayTimelines(question?: Question) {
  if (!question || !question.isStructured()) {
    return false;
  }
  const query = question.query() as StructuredQuery;
  const breakouts = query.breakouts();
  return breakouts.some(breakout => {
    const field = breakout.field();
    return field.isDate() || field.isTime();
  });
}

export function useQuestionTimelineEvents({ question }: Props): Result {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<unknown | null>(null);
  const [timelines, setTimelines] = useState([]);

  const fetchTimelines = useCallback(async () => {
    if (!question) {
      return;
    }
    const endpoint = question.isSaved()
      ? TimelineApi.getCardTimelines
      : TimelineApi.getTimelines;
    try {
      setStatus("loading");
      const result = await endpoint({
        cardId: question.id(),
        include: "events",
      });
      setTimelines(result);
      setStatus("success");
    } catch (e) {
      setError(e);
      setStatus("error");
    }
  }, [question]);

  useEffect(() => {
    if (checkShouldDisplayTimelines(question)) {
      fetchTimelines();
    }
  }, [question, fetchTimelines]);

  return {
    status,
    timelines,
    error,
    isLoading: status === "loading",
    isError: status === "error",
  };
}
