import assert from "node:assert/strict";
import test from "node:test";
import {
  fetchDashboardProjects,
  getDashboardCounts,
  getDashboardManagers,
  matchesDashboardManager,
  UNASSIGNED_MANAGER,
} from "../src/utils/dashboardData.js";

test("Dashboard reads every API page and sends the same inclusive start-date filter", async () => {
  const calls = [];
  const projects = await fetchDashboardProjects(
    async (query) => {
      calls.push(query);
      return {
        totalPages: 3,
        items: Array.from({ length: query.pageNumber === 3 ? 5 : 100 }, (_, index) => ({
          id: (query.pageNumber - 1) * 100 + index + 1,
        })),
      };
    },
    { startDateFrom: "2026-10-10", startDateTo: "2026-11-10" },
  );
  assert.equal(projects.length, 205);
  assert.deepEqual(
    calls.map((query) => query.pageNumber),
    [1, 2, 3],
  );
  assert.ok(
    calls.every(
      (query) =>
        query.startDateFrom === "2026-10-10" &&
        query.startDateTo === "2026-11-10" &&
        query.pageSize === 100,
    ),
  );
  assert.equal(
    await fetchDashboardProjects(
      () => assert.fail("obsolete requests must not run"),
      {},
      () => false,
    ),
    null,
  );
});

test("Manager counts preserve all 20 employees, shared assignments, unknown codes and unassigned projects", () => {
  const users = Array.from({ length: 20 }, (_, index) => ({
    code: String(index + 1).padStart(5, "0"),
    name: `Employee ${index}`,
  }));
  const projects = [
    { id: 1, manager: "00001,00002,00001", status: "PENDING" },
    { id: 2, manager: "00002,UNKNOWN", status: "COMPLETE" },
    { id: 3, manager: null, status: "HOLD" },
    { id: 4, manager: "00001", status: "CANCEL" },
  ];
  const rows = getDashboardManagers(projects, users);
  assert.equal(rows.length, 22);
  assert.equal(rows[0].totalProjects, 2);
  assert.equal(rows.find((row) => row.userCode === "00001").pendingProjects, 1);
  assert.equal(rows.find((row) => row.userCode === "00002").completeProjects, 1);
  assert.equal(rows.find((row) => row.userCode === "UNKNOWN").userName, "");
  assert.equal(rows.find((row) => row.userCode === "00020").totalProjects, 0);
  assert.equal(rows.find((row) => row.userCode === null).holdProjects, 1);
  assert.ok(
    rows.every(
      (row) =>
        row.totalProjects ===
        row.pendingProjects + row.completeProjects + row.holdProjects + row.cancelProjects,
    ),
  );
  assert.deepEqual(getDashboardCounts(projects), {
    total: 4,
    PENDING: 1,
    COMPLETE: 1,
    HOLD: 1,
    CANCEL: 1,
  });
  assert.equal(projects.filter((project) => matchesDashboardManager(project, "00002")).length, 2);
  assert.equal(
    projects.filter((project) => matchesDashboardManager(project, UNASSIGNED_MANAGER)).length,
    1,
  );
  assert.equal(projects.filter((project) => matchesDashboardManager(project, null)).length, 4);
});
