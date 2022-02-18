import React from "react";
import { renderHook } from "@testing-library/react-hooks";
import xhrMock from "xhr-mock";
import { UnsavedCard } from "metabase-types/types/Card";
import { DatetimeUnit } from "metabase-types/types/Query";
import Question from "metabase-lib/lib/Question";
import {
  metadata,
  SAMPLE_DATABASE,
  ORDERS,
  PRODUCTS,
} from "__support__/sample_database_fixture";
import { useQuestionTimelineEvents } from "./useQuestionTimelineEvents";

type QuestionFactoryOpts = {
  isSaved?: boolean;
  dateTimeUnit?: DatetimeUnit;
};

const SAVED_QUESTION_ID = 1;

function getQuestion({
  isSaved = true,
  dateTimeUnit = "month",
}: QuestionFactoryOpts = {}) {
  const baseCard: UnsavedCard = {
    display: "line",
    visualization_settings: {},
    dataset_query: {
      type: "query",
      database: SAMPLE_DATABASE.id,
      query: {
        "source-table": ORDERS.id,
        aggregation: [["count"]],
        breakout: [
          ["field", ORDERS.CREATED_AT.id, { "temporal-unit": dateTimeUnit }],
        ],
      },
    },
  };

  const card = isSaved
    ? {
        ...baseCard,
        id: SAVED_QUESTION_ID,
        can_write: true,
        public_uuid: "",
      }
    : baseCard;

  return new Question(card, metadata);
}

async function setup({
  question,
  waitForRequest = true,
}: {
  question?: Question;
  waitForRequest?: boolean;
}) {
  const result = renderHook(
    ({ question }) => useQuestionTimelineEvents({ question }),
    {
      initialProps: {
        question,
      },
    },
  );

  if (waitForRequest) {
    await result.waitForNextUpdate();
  }

  return result;
}

describe("useQuestionTimelineEvents", () => {
  const ALL_TIMELINES = ["Response for all timelines"];
  const CARD_TIMELINES = ["Response for card timelines"];

  beforeEach(() => {
    xhrMock.setup();

    xhrMock.get(/\/api\/timeline*/, {
      body: JSON.stringify(ALL_TIMELINES),
    });

    xhrMock.get(
      new RegExp(`\\/api\\/card\\/${SAVED_QUESTION_ID}\\/timelines*`),
      {
        body: JSON.stringify(CARD_TIMELINES),
      },
    );
  });

  afterEach(() => {
    xhrMock.teardown();
  });

  it("should fetch timelines for saved question correctly", async () => {
    const { result } = await setup({
      question: getQuestion({ isSaved: true }),
    });
    expect(result.current).toEqual({
      status: "success",
      timelines: CARD_TIMELINES,
      error: null,
      isLoading: false,
      isError: false,
    });
  });

  it("should fetch timelines for ad-hoc question correctly", async () => {
    const { result } = await setup({
      question: getQuestion({ isSaved: false }),
    });
    expect(result.current).toEqual({
      status: "success",
      timelines: ALL_TIMELINES,
      error: null,
      isLoading: false,
      isError: false,
    });
  });

  it("should fetch timelines when question meets timeline requirements", async () => {
    const { result, rerender, waitForNextUpdate } = await setup({
      question: ORDERS.question(),
      waitForRequest: false,
    });

    rerender({ question: getQuestion({ isSaved: false }) });
    await waitForNextUpdate();

    expect(result.current).toEqual({
      status: "success",
      timelines: ALL_TIMELINES,
      error: null,
      isLoading: false,
      isError: false,
    });
  });

  it("should not try to fetch timelines for new question", async () => {
    const { result } = await setup({
      question: undefined,
      waitForRequest: false,
    });
    expect(result.current).toEqual({
      status: "idle",
      timelines: [],
      error: null,
      isLoading: false,
      isError: false,
    });
  });

  it("should not try to fetch timelines for queries without a breakout", async () => {
    const { result } = await setup({
      question: ORDERS.question(),
      waitForRequest: false,
    });
    expect(result.current).toEqual({
      status: "idle",
      timelines: [],
      error: null,
      isLoading: false,
      isError: false,
    });
  });

  it("should not try to fetch timelines for queries with non-temporal breakout", async () => {
    const { result } = await setup({
      question: new Question(
        {
          id: SAVED_QUESTION_ID,
          can_write: true,
          public_uuid: "",
          display: "line",
          visualization_settings: {},
          dataset_query: {
            type: "query",
            database: SAMPLE_DATABASE.id,
            query: {
              "source-table": PRODUCTS.id,
              aggregation: [["count"]],
              breakout: [PRODUCTS.CATEGORY.reference()],
            },
          },
        },
        metadata,
      ),
      waitForRequest: false,
    });

    expect(result.current).toEqual({
      status: "idle",
      timelines: [],
      error: null,
      isLoading: false,
      isError: false,
    });
  });

  it("should not try to fetch timelines for native queries", async () => {
    const { result } = await setup({
      question: new Question(
        {
          id: SAVED_QUESTION_ID,
          can_write: true,
          public_uuid: "",
          display: "line",
          visualization_settings: {},
          dataset_query: {
            type: "native",
            database: SAMPLE_DATABASE.id,
            native: {
              query: "select * from products",
              "template-tags": {},
            },
          },
        },
        metadata,
      ),
      waitForRequest: false,
    });

    expect(result.current).toEqual({
      status: "idle",
      timelines: [],
      error: null,
      isLoading: false,
      isError: false,
    });
  });
});
