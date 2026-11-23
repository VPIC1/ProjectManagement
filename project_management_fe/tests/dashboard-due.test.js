import assert from "node:assert/strict";
import test from "node:test";
import { chartProjectQuery } from "../src/utils/dashboardChartQuery.js";

test("Due-month drilldown uses server paging and exact chart status filters", () => {
  for (const group of ["complete", "late", "open"]) {
    assert.deepEqual(
      chartProjectQuery({ kind: "due", year: 2025, month: 12, group }, 3, "2026-11-16"),
      {
        endpoint: "dashboard",
        params: { year: 2025, dueMonth: 12, dueStatus: group, projectPage: 3, projectPageSize: 20 },
      },
    );
  }
});

test("Recent due months retain missing and empty months, including previous-year months", async () => {
  const { dueMonthRows } = await import("../src/utils/dashboardDueMonths.js");
  const october = { year: 2026, month: 10, complete: 2, overdue: 1, notOverdue: 0, total: 3 };
  const november = { year: 2026, month: 11, complete: 0, overdue: 1, notOverdue: 3, total: 4 };
  const rows = dueMonthRows([october, november], 2026, "2026-11-16");
  assert.deepEqual(
    rows.map((row) => [row.year, row.month, row.total]),
    [
      [2026, 9, 0],
      [2026, 10, 3],
      [2026, 11, 4],
    ],
  );
  assert.equal(rows[1], october);
  assert.equal(rows[2], november);
  assert.deepEqual(
    dueMonthRows([], 2027, "2027-01-05").map((row) => [row.year, row.month, row.total]),
    [
      [2026, 11, 0],
      [2026, 12, 0],
      [2027, 1, 0],
    ],
  );
  assert.deepEqual(
    dueMonthRows([], 2025, "2026-11-16").map((row) => row.month),
    [10, 11, 12],
  );
  assert.deepEqual(dueMonthRows([], 2027, "2026-11-16"), []);
});
