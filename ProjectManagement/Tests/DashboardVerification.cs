using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using ProjectManagement.Data;
using ProjectManagement.Models;

namespace ProjectManagement.ApiTests;

internal static class DashboardVerification
{
    public static async Task<int> Run(string root)
    {
        using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        var clock = new TestClock(new DateTimeOffset(2026, 11, 7, 20, 0, 0, TimeSpan.Zero)); // 08/11 tại Việt Nam.
        await using var factory = new WebApplicationFactory<global::Program>().WithWebHostBuilder(builder =>
        {
            builder.UseContentRoot(root).UseEnvironment("Development");
            builder.ConfigureServices(services =>
            {
                services.AddSingleton<TimeProvider>(clock);
                services.RemoveAll<ApplicationDbContext>();
                services.AddScoped<ApplicationDbContext>(_ => new TestDbContext(new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlite(connection).Options));
            });
        });
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://localhost") });
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            await db.Database.EnsureCreatedAsync();
            var rows = new List<Project>();
            void Add(string code, WorkStatus status, DateOnly? start, DateOnly? end) => rows.Add(new Project
                { ProjectCode = code, ProjectName = code, Status = status, StartDate = start, EndDate = end });
            Add("OLD_DONE", WorkStatus.COMPLETE, new(2021, 1, 1), new(2021, 12, 31));
            Add("DONE_2026", WorkStatus.COMPLETE, new(2024, 1, 1), new(2026, 1, 1));
            Add("DONE_2027", WorkStatus.COMPLETE, new(2026, 1, 1), new(2027, 1, 1));
            Add("CANCEL_2026", WorkStatus.CANCEL, new(2025, 1, 1), new(2026, 12, 31));
            Add("NO_END_DONE", WorkStatus.COMPLETE, new(2026, 1, 1), null);
            Add("OVERDUE", WorkStatus.PENDING, new(2020, 1, 1), new(2026, 11, 7));
            Add("TODAY", WorkStatus.PENDING, new(2026, 1, 1), new(2026, 11, 8));
            Add("SEVEN_DAYS", WorkStatus.HOLD, new(2022, 1, 1), new(2026, 11, 15));
            Add("EIGHT_DAYS", WorkStatus.PENDING, new(2026, 1, 1), new(2026, 11, 16));
            Add("NO_DATE", WorkStatus.PENDING, null, null);
            Add("FUTURE_START", WorkStatus.HOLD, new(2027, 1, 1), new(2027, 1, 15));
            for (var i = 0; i < 10; i++) Add($"PAGE_{i}", WorkStatus.PENDING, null, new(2026, 12, 1));
            rows.Single(p => p.ProjectCode == "OVERDUE").Tasks.Add(new ProjectTask { TaskName = "A", Progress = 25, StartDate = new(2026, 11, 1), EndDate = new(2026, 11, 15) });
            rows.Single(p => p.ProjectCode == "OVERDUE").Tasks.Add(new ProjectTask { TaskName = "B", Progress = 75, StartDate = new(2026, 11, 9), EndDate = new(2026, 11, 20) });
            var department = new Department { Name = "Department A", GroupId = "TEST-DEPARTMENT-A", SortOrder = 1 };
            rows.Single(p => p.ProjectCode == "OVERDUE").RequesterDepartment = department;
            rows.Single(p => p.ProjectCode == "DONE_2026").RequesterDepartment = department;
            rows.Single(p => p.ProjectCode == "DONE_2026").CreatedDate = new DateTime(2025, 12, 15);
            rows.Single(p => p.ProjectCode == "OVERDUE").CreatedDate = new DateTime(2026, 2, 1);
            foreach (var row in rows)
            {
                row.UpdatedDate = new DateTime(2026, 11, 6, 8, 0, 0);
                foreach (var task in row.Tasks) task.UpdatedDate = new DateTime(2026, 11, 7, 8, 0, 0);
            }
            // The report must include task-only changes, but not unrelated closed history.
            rows.Single(p => p.ProjectCode == "OVERDUE").Tasks.Last().UpdatedDate = new DateTime(2026, 11, 8, 9, 30, 0);
            rows.Single(p => p.ProjectCode == "OLD_DONE").UpdatedDate = new DateTime(2030, 1, 1);
            db.Projects.AddRange(rows);
            await db.SaveChangesAsync();
        }
        var count = 0;
        void Check(bool valid, string label) { if (!valid) throw new Exception("Dashboard: " + label); count++; }
        async Task<JsonElement> Get(string query)
        {
            using var response = await client.GetAsync("/api/projects/dashboard" + query);
            Check(response.IsSuccessStatusCode, await response.Content.ReadAsStringAsync());
            return (await response.Content.ReadFromJsonAsync<JsonElement>()).Clone();
        }
        var data = await Get("?year=2026");
        Check(data.GetProperty("today").GetString() == "2026-11-08", "Vietnam timezone");
        Check(data.GetProperty("generatedAt").GetDateTimeOffset() == clock.GetUtcNow(), "report timestamp comes from server clock");
        var chartCounts = data.GetProperty("overview");
        Check(chartCounts.GetProperty("pendingNotOverdue").GetInt32() == 13 && chartCounts.GetProperty("holdNotOverdue").GetInt32() == 1,
            "non-overdue slices exclude overdue projects and retain missing deadlines");
        Check(chartCounts.GetProperty("pendingNotOverdue").GetInt32() + chartCounts.GetProperty("holdNotOverdue").GetInt32() +
            chartCounts.GetProperty("complete").GetInt32() + chartCounts.GetProperty("cancel").GetInt32() +
            chartCounts.GetProperty("overdue").GetInt32() == chartCounts.GetProperty("total").GetInt32(), "overview slices never double-count overdue projects");
        foreach (var (view, expected) in new[] { ("active-not-late", 13), ("hold-not-late", 1), ("late", 1) })
        {
            var slice = await Get($"?year=2026&view={view}&projectPageSize=50");
            Check(slice.GetProperty("projects").GetProperty("totalCount").GetInt32() == expected, "slice click matches its exact count: " + view);
        }
        var expectedUpdate = new DateTimeOffset(new DateTime(2026, 11, 8, 9, 30, 0),
            TimeZoneInfo.Local.GetUtcOffset(new DateTime(2026, 11, 8, 9, 30, 0)));
        Check(data.GetProperty("dataUpdatedAt").GetDateTimeOffset() == expectedUpdate,
            "latest update includes task changes and excludes unrelated history");
        var dueMonths = data.GetProperty("dueMonths").EnumerateArray().ToList();
        var novemberDue = dueMonths.Single(m => m.GetProperty("month").GetInt32() == 11);
        Check(novemberDue.GetProperty("total").GetInt32() == 4 && novemberDue.GetProperty("overdue").GetInt32() == 1 &&
            novemberDue.GetProperty("notOverdue").GetInt32() == 3, "due months include HOLD and due today as not overdue");
        Check(dueMonths.All(m => m.GetProperty("year").GetInt32() == 2026 && m.GetProperty("month").GetInt32() >= 9 && m.GetProperty("month").GetInt32() <= 11),
            "due chart includes current month and two preceding months only");
        Check(!dueMonths.Any(m => m.GetProperty("month").GetInt32() == 12), "future due months excluded");
        foreach (var bucket in dueMonths)
            Check(bucket.GetProperty("total").GetInt32() == bucket.GetProperty("complete").GetInt32() +
                bucket.GetProperty("overdue").GetInt32() + bucket.GetProperty("notOverdue").GetInt32(), "mutually exclusive due groups");
        foreach (var (month, group, expected) in new[] { (11, "late", 1), (11, "open", 3), (11, "complete", 0), (1, "complete", 1), (12, "all", 10) })
        {
            var drilldown = await Get($"?year=2026&dueMonth={month}&dueStatus={group}&projectPageSize=20");
            Check(drilldown.GetProperty("projects").GetProperty("totalCount").GetInt32() == expected,
                $"due-month drilldown matches {month}/{group}");
            Check(drilldown.GetProperty("dueMonths").GetRawText() == data.GetProperty("dueMonths").GetRawText(),
                "drilldown preserves global due chart");
        }
        foreach (var query in new[] { "dueMonth=0", "dueMonth=13", "dueStatus=bad" })
        {
            using var invalidDue = await client.GetAsync("/api/projects/dashboard?year=2026&" + query);
            Check(invalidDue.StatusCode == HttpStatusCode.BadRequest, "invalid due-month query rejected");
        }
        var emptyReport = await Get("?year=1900");
        Check(emptyReport.GetProperty("dueMonths").GetArrayLength() == 0 && emptyReport.GetProperty("dataUpdatedAt").ValueKind == JsonValueKind.Null,
            "empty report has no fabricated update time or due data");
        var directory = await client.GetFromJsonAsync<JsonElement>("/api/departments");
        Check(directory.GetArrayLength() == 1 && directory[0].GetProperty("name").GetString() == "Department A", "department lookup endpoint");
        var departmentId = directory[0].GetProperty("id").GetInt32();
        var departmentData = await Get($"?year=2026&departmentId={departmentId}");
        Check(departmentData.GetProperty("summary").GetProperty("total").GetInt32() == 2, "department scopes status counts");
        Check(departmentData.GetProperty("projects").GetProperty("totalCount").GetInt32() == 1,
            "department scopes only the progress project list");
        foreach (var field in new[] { "overview", "months", "attention", "attentionSummary", "comparison", "departments" })
            Check(departmentData.GetProperty(field).GetRawText() == data.GetProperty(field).GetRawText(),
                $"department preserves global {field}");
        var comparisonNextPage = await Get($"?year=2026&departmentId={departmentId}&comparisonPage=2");
        Check(comparisonNextPage.GetProperty("comparison").GetProperty("pageNumber").GetInt32() == 2 &&
            comparisonNextPage.GetProperty("projects").GetProperty("pageNumber").GetInt32() == 1,
            "comparison has independent pagination");
        var globalOverview = data.GetProperty("overview").GetRawText();
        Check(departmentData.GetProperty("overview").GetRawText() == globalOverview, "department does not change the overview cards");
        var breakdown = departmentData.GetProperty("departments");
        Check(breakdown.GetArrayLength() == 2 && breakdown[0].GetProperty("count").GetInt32() == 15
            && breakdown[1].GetProperty("count").GetInt32() == 2, "department chart retains overall distribution and is sorted");
        var unassigned = await Get("?year=2026&departmentId=0");
        Check(unassigned.GetProperty("summary").GetProperty("total").GetInt32() == 15, "unassigned filter");
        Check(unassigned.GetProperty("overview").GetRawText() == globalOverview, "unassigned filter does not change the overview cards");
        Check(unassigned.GetProperty("comparison").GetRawText() == data.GetProperty("comparison").GetRawText() &&
            unassigned.GetProperty("months").GetRawText() == data.GetProperty("months").GetRawText(),
            "unassigned filter only scopes the progress project list");
        var projectId = departmentData.GetProperty("projects").GetProperty("items")[0].GetProperty("id").GetInt32();
        var projectDetails = await client.GetFromJsonAsync<JsonElement>($"/api/projects/{projectId}");
        Check(projectDetails.GetProperty("requesterDepartmentId").GetInt32() == departmentId
            && projectDetails.GetProperty("requesterDepartmentName").GetString() == "Department A", "project details show department");
        var summary = data.GetProperty("summary");
        foreach (var field in new[] { "total", "pending", "complete", "hold", "cancel", "overdue" })
            Check(data.GetProperty("overview").GetProperty(field).GetInt32() == summary.GetProperty(field).GetInt32(), $"overview matches unfiltered {field}");
        Check(summary.GetProperty("total").GetInt32() == 17, "closed history excluded and old open projects included");
        Check(summary.GetProperty("pending").GetInt32() == 14 && summary.GetProperty("hold").GetInt32() == 1, "open status counts");
        Check(summary.GetProperty("complete").GetInt32() == 1 && summary.GetProperty("cancel").GetInt32() == 1, "end date determines reporting year");
        Check(summary.GetProperty("overdue").GetInt32() == 1 && summary.GetProperty("dueSoon").GetInt32() == 2, "today and seven-day boundaries, null dates excluded");
        var page = data.GetProperty("projects");
        Check(page.GetProperty("items").GetArrayLength() == 5 && page.GetProperty("totalCount").GetInt32() == 14, "server paging and active view");
        Check(page.GetProperty("items")[0].GetProperty("projectCode").GetString() == "OVERDUE", "earliest end date first");
        Check(page.GetProperty("items")[0].GetProperty("progressPercent").GetDecimal() == 50, "average task progress");
        Check(!page.GetProperty("items")[0].TryGetProperty("description", out _), "compact response excludes description");
        Check(page.GetProperty("items")[0].GetProperty("plannedProgressPercent").GetDecimal() == 25,
            "project plan averages task schedules (50 and 0), not overdue project dates");
        Check(page.GetProperty("items")[0].GetProperty("startDate").GetString() == "2020-01-01", "timeline includes planned start");
        foreach (var (start, end, status, expected) in new (DateOnly?, DateOnly?, WorkStatus, decimal?)[]
        {
            (null, new(2026, 11, 20), WorkStatus.PENDING, null),
            (new(2026, 11, 9), new(2026, 11, 20), WorkStatus.PENDING, 0),
            (new(2026, 11, 1), new(2026, 11, 15), WorkStatus.PENDING, 50),
            (new(2026, 11, 8), new(2026, 11, 8), WorkStatus.PENDING, 100),
            (new(2026, 11, 1), new(2026, 11, 15), WorkStatus.CANCEL, null),
            (new(2026, 11, 9), new(2026, 11, 1), WorkStatus.PENDING, null)
        })
        {
            var planned = new ProjectManagement.Contracts.DashboardProject(0, "", "", status, end)
                { StartDate = start, TaskSchedules = [new(start, end)], AsOfDate = new(2026, 11, 8) };
            Check(planned.PlannedProgressPercent == expected, "planned progress handles missing, future, elapsed and cancelled schedules");
        }
        Check(ProjectProgress.ActualPercent(0, 0) == 0, "empty actual progress remains zero");
        Check(ProjectProgress.ActualPercent(100, 3) == 33.3m, "actual progress rounds once after averaging");
        Check(BusinessDate.Today(new TestClock(new DateTimeOffset(2026, 11, 10, 17, 0, 0, TimeSpan.Zero))) == new DateOnly(2026, 11, 11),
            "business date crosses midnight in Vietnam independently of server timezone");
        var mixedSchedules = new TaskSchedule[] { new(new(2026, 11, 1), new(2026, 11, 15)), new(new(2026, 11, 9), new(2026, 11, 20)) };
        Check(ProjectProgress.PlannedTaskPercent(mixedSchedules, WorkStatus.PENDING, new(2026, 11, 8)) == 25, "equal task weights");
        Check(ProjectProgress.PlannedTaskPercent([], WorkStatus.PENDING, new(2026, 11, 8)) is null, "empty task plan is unknown");
        Check(ProjectProgress.PlannedTaskPercent([mixedSchedules[0], new(null, new(2026, 11, 20))], WorkStatus.PENDING, new(2026, 11, 8)) is null, "missing task dates do not create a misleading partial average");
        Check(ProjectProgress.PlannedTaskPercent(mixedSchedules, WorkStatus.CANCEL, new(2026, 11, 8)) is null, "cancelled project remains unmeasured");
        var overdueId = page.GetProperty("items")[0].GetProperty("id").GetInt32();
        var detail = await client.GetFromJsonAsync<JsonElement>($"/api/projects/{overdueId}");
        Check(detail.GetProperty("plannedProgressPercent").GetDecimal() == 25, "project detail uses identical task plan");
        var list = await client.GetFromJsonAsync<JsonElement>("/api/projects?search=OVERDUE");
        Check(list.GetProperty("items")[0].GetProperty("plannedProgressPercent").GetDecimal() == 25, "project list uses identical task plan");
        Check(!detail.TryGetProperty("taskSchedules", out _), "internal schedules are not serialized");
        var months = data.GetProperty("months");
        Check(months.GetArrayLength() == 12 && months[0].GetProperty("started").GetInt32() == 4, "twelve monthly buckets count actual starts regardless status");
        Check(months[10].GetProperty("plannedEnd").GetInt32() == 4 && months[11].GetProperty("plannedEnd").GetInt32() == 10, "monthly planned end dates");
        var all = await Get("?year=2026&view=all&projectPage=999999&attention=soon");
        Check(all.GetProperty("projects").GetProperty("pageNumber").GetInt32() == 4, "page clamped after data changes");
        Check(all.GetProperty("attention").GetProperty("totalCount").GetInt32() == 2, "soon mode");
        foreach (var (view, status, countField) in new[]
        {
            ("complete", "COMPLETE", "complete"), ("hold", "HOLD", "hold"), ("cancel", "CANCEL", "cancel")
        })
        {
            var filtered = await Get($"?year=2026&view={view}");
            var projects = filtered.GetProperty("projects");
            Check(projects.GetProperty("totalCount").GetInt32() == summary.GetProperty(countField).GetInt32() &&
                projects.GetProperty("items").EnumerateArray().All(project => project.GetProperty("status").GetString() == status),
                $"overview card {view} matches the summary and project status");
        }
        var scopedComplete = await Get($"?year=2026&view=complete&departmentId={departmentId}");
        Check(scopedComplete.GetProperty("projects").GetProperty("items")[0].GetProperty("projectCode").GetString() == "DONE_2026",
            "completed card respects the reporting year and department");
        var old = await Get("?year=2021");
        Check(old.GetProperty("summary").GetProperty("complete").GetInt32() == 1 &&
            old.GetProperty("summary").GetProperty("pending").GetInt32() == 1, "historical year excludes later project starts and retains earlier open projects");
        Check(old.GetProperty("summary").GetProperty("overdue").GetInt32() == 1, "attention follows the eligible reporting-year projects");
        foreach (var view in new[] { "all", "active", "hold", "late", "soon" })
        {
            var historical = await Get($"?year=2025&view={view}");
            foreach (var field in new[] { "projects", "comparison", "attention" })
                Check(historical.GetProperty(field).GetProperty("items").EnumerateArray()
                    .All(project => project.GetProperty("startDate").ValueKind == JsonValueKind.Null ||
                        DateOnly.Parse(project.GetProperty("startDate").GetString()!) < new DateOnly(2026, 1, 1)),
                    $"historical {field}/{view} excludes projects starting in later years");
            Check(historical.GetProperty("overview").GetProperty("total").GetInt32() == 2 &&
                historical.GetProperty("departments").EnumerateArray().Sum(department => department.GetProperty("count").GetInt32()) == 2,
                "historical overview and departments share the same reporting-year scope");
        }
        Check(summary.GetProperty("onTimePercent").ValueKind == JsonValueKind.Null && summary.GetProperty("missingActualEnd").GetInt32() == 1, "missing dates do not imply zero percent");
        Check(months[11].GetProperty("actualCompleted").ValueKind == JsonValueKind.Null && months[0].GetProperty("actualCompleted").GetInt32() == 0, "future actuals are null, elapsed months zero");
        var lateView = await Get("?year=2026&view=late");
        Check(lateView.GetProperty("projects").GetProperty("totalCount").GetInt32() == 1, "late filter uses current dates");
        var soonView = await Get("?year=2021&view=soon");
        Check(soonView.GetProperty("projects").GetProperty("totalCount").GetInt32() == 0, "soon filter excludes projects starting after the selected report year");
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            db.Projects.AddRange(
                new Project { ProjectCode = "ON_TIME", ProjectName = "On time", Status = WorkStatus.COMPLETE, EndDate = new(2026, 2, 20), ActualEndDate = new(2026, 2, 18) },
                new Project { ProjectCode = "LATE_DONE", ProjectName = "Late completed", Status = WorkStatus.COMPLETE, EndDate = new(2026, 1, 2), ActualEndDate = new(2026, 1, 5) });
            var crossYear = await db.Projects.SingleAsync(p => p.ProjectCode == "DONE_2027");
            crossYear.ActualEndDate = new(2026, 11, 7);
            var unfinished = await db.Projects.SingleAsync(p => p.ProjectCode == "TODAY");
            unfinished.ActualEndDate = new(2026, 11, 7); // Chưa COMPLETE không tính vào hoàn thành thực tế.
            await db.SaveChangesAsync();
        }
        var updated = await Get("?year=2026");
        var quality = updated.GetProperty("summary");
        Check(quality.GetProperty("complete").GetInt32() == 3 && quality.GetProperty("measuredComplete").GetInt32() == 2, "annual cohort still determined by planned end date");
        Check(quality.GetProperty("onTimeComplete").GetInt32() == 1 && quality.GetProperty("lateComplete").GetInt32() == 1 && quality.GetProperty("onTimePercent").GetDecimal() == 50, "on time rate excludes missing actual dates");
        Check(quality.GetProperty("maxOverdueDays").GetInt32() == 1, "longest overdue computed from current Vietnam date");
        Check(updated.GetProperty("months")[10].GetProperty("actualCompleted").GetInt32() == 1, "actual completion month independent of planned year and ignores unfinished projects");
        Check(updated.GetProperty("months")[0].GetProperty("actualCompleted").GetInt32() == 1 && updated.GetProperty("months")[1].GetProperty("actualCompleted").GetInt32() == 1, "actual completion monthly aggregation");
        Check(updated.GetProperty("months")[0].GetProperty("lateCompleted").GetInt32() == 1
            && updated.GetProperty("months")[1].GetProperty("onTimeCompleted").GetInt32() == 1, "monthly on-time and late buckets");
        foreach (var query in new[] { "year=0", "year=9999", "view=bad", "attention=bad", "projectPage=0", "comparisonPage=0", "attentionPage=2147483647" })
        {
            using var response = await client.GetAsync("/api/projects/dashboard?" + query);
            Check(response.StatusCode == HttpStatusCode.BadRequest, "query validation: " + query);
        }
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            db.Projects.AddRange(
                new Project { ProjectCode = "BOTH_MONTH", ProjectName = "Both", Status = WorkStatus.COMPLETE, StartDate = new(2026, 3, 1), ActualEndDate = new(2026, 3, 10) },
                new Project { ProjectCode = "START_ONLY", ProjectName = "Start", Status = WorkStatus.PENDING, StartDate = new(2026, 3, 2) },
                new Project { ProjectCode = "END_ONLY", ProjectName = "End", Status = WorkStatus.COMPLETE, StartDate = new(2026, 2, 1), ActualEndDate = new(2026, 3, 3) },
                new Project { ProjectCode = "NOT_COMPLETE", ProjectName = "Pending", Status = WorkStatus.PENDING, StartDate = new(2026, 2, 1), ActualEndDate = new(2026, 3, 3) });
            await db.SaveChangesAsync();
        }
        var activity = await client.GetFromJsonAsync<JsonElement>("/api/projects?activityYear=2026&activityMonth=3");
        var activityCodes = activity.GetProperty("items").EnumerateArray().Select(p => p.GetProperty("projectCode").GetString()).Order().ToArray();
        Check(activityCodes.SequenceEqual(new[] { "BOTH_MONTH", "END_ONLY", "START_ONLY" }), "month activity combines starts/completions without duplicates or unfinished completions");
        foreach (var query in new[] { "activityYear=2026", "activityMonth=3", "activityYear=2026&activityMonth=13" })
        {
            using var invalidActivity = await client.GetAsync("/api/projects?" + query);
            Check(invalidActivity.StatusCode == HttpStatusCode.BadRequest, "activity query validation: " + query);
        }
        clock.UtcNow = new DateTimeOffset(2027, 1, 4, 20, 0, 0, TimeSpan.Zero);
        var januaryReport = await Get("?year=2027");
        var crossingMonths = januaryReport.GetProperty("dueMonths").EnumerateArray().ToList();
        Check(crossingMonths.Select(m => (m.GetProperty("year").GetInt32(), m.GetProperty("month").GetInt32()))
            .SequenceEqual(new[] { (2026, 11), (2026, 12), (2027, 1) }), "three-month range crosses year boundary correctly");
        Check(crossingMonths.Single(m => m.GetProperty("month").GetInt32() == 12).GetProperty("total").GetInt32() == 10,
            "cancelled projects remain excluded from recent due months");
        var januaryCounts = januaryReport.GetProperty("overview");
        Check(januaryCounts.GetProperty("holdNotOverdue").GetInt32() == 1, "future HOLD project remains separate from overdue HOLD");
        var historicalReport = await Get("?year=2026");
        Check(historicalReport.GetProperty("overview").GetProperty("holdNotOverdue").GetInt32() == 0,
            "overdue HOLD project is only in the red slice");
        Check(historicalReport.GetProperty("dueMonths").EnumerateArray().All(m => m.GetProperty("year").GetInt32() == 2026 && m.GetProperty("month").GetInt32() >= 10),
            "past report year uses its final three months");
        var futureReport = await Get("?year=2028");
        Check(futureReport.GetProperty("dueMonths").GetArrayLength() == 0, "future reporting year does not show future due months");
        return count;
    }
}
