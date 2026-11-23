using ProjectManagement.Diagnostics;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;
using ProjectManagement.Services;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using ClosedXML.Excel;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using ProjectManagement.Data;
using ProjectManagement.Models;

namespace ProjectManagement.ApiTests;

public static class ApiTestRunner
{
    private static int assertions;
    public static async Task Main()
    {
        var clock = new TestClock(new DateTimeOffset(2026, 11, 7, 0, 0, 0, TimeSpan.Zero));
        using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var factory = new WebApplicationFactory<global::Program>().WithWebHostBuilder(builder =>
        {
            builder.UseContentRoot(GetProjectRoot());
            builder.UseEnvironment("Development");
            builder.ConfigureServices(services =>
            {
                services.AddControllers().AddApplicationPart(typeof(ErrorProbeController).Assembly);
                services.AddSingleton<TimeProvider>(clock);
                services.RemoveAll<ApplicationDbContext>();
                services.AddScoped<ApplicationDbContext>(_ => new TestDbContext(
                    new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlite(connection,
                        sqlite => sqlite.ExecutionStrategy(dependencies => new SqlServerRetryingExecutionStrategy(dependencies))).Options));
            });
        });
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://localhost") });
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            Check(db.Database.CreateExecutionStrategy().RetriesOnFailure, "API tests enforce SQL Server retry transaction rules");
            await db.Database.EnsureCreatedAsync();
            db.Set<ProjectCodeCounter>().Add(new ProjectCodeCounter { Prefix = "MIS", Period = "2611", LastNumber = 25 });
            db.ProjectUsers.AddRange(
                new ProjectUser { Code = "An", Name = "Nguyễn Văn An" },
                new ProjectUser { Code = "Chi", Name = "Trần Thị Chi" },
                new ProjectUser { Code = "01959", Name = "Đàm Đức Hải" });
            await db.SaveChangesAsync();
        }

        await VerifyCors(client);
        await VerifyFrontendHosting(client);
        await VerifyFrontendHosting(client, "/it-project-demo");
        await Expect(client, HttpMethod.Get, "/it-project-demo/api/projects/statistics", null, HttpStatusCode.OK);
        await VerifyApiErrors(client, factory.Services);

        var openApi = await Expect(client, HttpMethod.Get, "/openapi/v1.json", null, HttpStatusCode.OK);
        Check(openApi.GetProperty("paths").TryGetProperty("/api/projects", out _) &&
              openApi.GetProperty("paths").TryGetProperty("/api/tasks", out _), "OpenAPI contains both resources");

        Check(openApi.GetProperty("paths").TryGetProperty("/api/projects/statistics", out _), "Statistics in OpenAPI");
        await AssertStatistics(client, 0, 0, 0, 0, 0);

        // Validate query translation against the actual SQL Server provider too.
        using (var sqlDb = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseSqlServer("Server=unused;Database=unused;Integrated Security=True").Options))
        {
            var query = sqlDb.Projects.AsNoTracking().ApplyCommonFilters(new ProjectManagement.Contracts.ProjectListQuery
            {
                Status = [WorkStatus.PENDING, WorkStatus.HOLD],
                StartDateFrom = new DateOnly(2026, 1, 1),
                CreatedDateTo = new DateTime(2026, 12, 31)
            }).ApplySearch("example", "ProjectName", "Description")
              .ContainsText("Manager", "An")
              .ApplyPaging(new ProjectManagement.Contracts.ProjectListQuery { SortBy = "projectName", PageNumber = 2, PageSize = 10 });
            var sql = query.Select(ProjectManagement.Contracts.ProjectResponse.Projection).ToQueryString();
            Check(sql.Contains("OFFSET") && sql.Contains("FETCH") && sql.Contains("[project_name_vi]") && sql.Contains("[project_name_zh]") && !sql.Contains("[project_name]") && !sql.Contains("[description]"), "SQL Server translation");
            Check(sql.Contains("COUNT(*)") && sql.Contains("SUM(") && sql.Contains("[progress]") && sql.Contains("[tasks]"), "Task counts and progress totals translated to SQL");
            var managerSql = sqlDb.Projects.ContainsUser(sqlDb.ProjectUsers, "Manager", "Chi", multiple: true).ToQueryString();
            Check(managerSql.Contains("[project_users]") && managerSql.Contains("EXISTS"), "CSV manager name filter translates with SQL Server provider");
            var employeeSql = sqlDb.Projects.FilterEmployeeCodes(["01959", "An"]).ToQueryString();
            Check(employeeSql.Contains("[manager]"), "Multiple employee selection translates with SQL Server provider");
        }

        foreach (var path in new[] {
            "/api/projects?pageNumber=0", "/api/tasks?pageSize=101",
            "/api/projects?pageNumber=2147483647&pageSize=100",
            "/api/projects?sortBy=unsafe", "/api/tasks?sortDirection=sideways",
            "/api/projects?status=UNKNOWN", "/api/tasks?status=99",
            "/api/projects?startDateFrom=2026-12-01&startDateTo=2026-01-01",
            "/api/tasks?createdDateFrom=2026-12-01&createdDateTo=2026-01-01",
            "/api/projects?endDateFrom=invalid", "/api/tasks?updatedDateFrom=2026-12-01&updatedDateTo=2026-01-01" })
            await Expect(client, HttpMethod.Get, path, null, HttpStatusCode.BadRequest);

        var invalid = ProjectBody("Invalid");
        invalid["startDate"] = "2026-12-01";
        invalid["endDate"] = "2026-01-01";
        await Expect(client, HttpMethod.Post, "/api/projects", invalid, HttpStatusCode.BadRequest);
        invalid["endDate"] = "2026-12-31";
        invalid["status"] = 99;
        await Expect(client, HttpMethod.Post, "/api/projects", invalid, HttpStatusCode.BadRequest);
        invalid["status"] = "INVALID";
        await Expect(client, HttpMethod.Post, "/api/projects", invalid, HttpStatusCode.BadRequest);
        await Expect(client, HttpMethod.Post, "/api/projects", new { projectCode = " ", projectName = " " }, HttpStatusCode.BadRequest);
        await Expect(client, HttpMethod.Post, "/api/tasks", new { projectCode = "MISSING", taskName = "Orphan" }, HttpStatusCode.BadRequest);

        var alpha = await Expect(client, HttpMethod.Post, "/api/projects", ProjectBody("Alpha"), HttpStatusCode.Created);
        var alphaId = alpha.GetProperty("id").GetInt32();
        var alphaCode = alpha.GetProperty("projectCode").GetString()!;
        await AssertProjectProgress(client, alphaId, 0, 0, 0m);
        var fraction = ProjectManagement.Contracts.ProjectResponse.Projection.Compile()(new Project
        {
            Tasks = new List<ProjectTask> { new() { Status = WorkStatus.COMPLETE, Progress = 40 }, new() { Status = WorkStatus.CANCEL, Progress = 20 }, new() { Status = WorkStatus.HOLD, Progress = 40 } }
        });
        Check(fraction.TotalTasks == 3 && fraction.CompletedTasks == 1 && fraction.ProgressPercent == 33.3m, "Progress averages task percentages across all statuses and rounds to one decimal");
        Check(alphaCode == "IT2611001", "IT starts at 001 independently of the MIS monthly counter");
        Check(alpha.GetProperty("status").GetString() == "PENDING", "Enum response as string");
        Check(alpha.GetProperty("createdDate").GetDateTime() != default, "Generated timestamps");
        Check(!alpha.TryGetProperty("tasks", out _), "No navigation cycle");
        await Expect(client, HttpMethod.Post, "/api/projects", new { projectCode = "USER001", projectName = "Custom code" }, HttpStatusCode.BadRequest);
        var betaBody = ProjectBody("Beta");
        betaBody["status"] = "HOLD";
        var beta = await Expect(client, HttpMethod.Post, "/api/projects", betaBody, HttpStatusCode.Created);
        var betaId = beta.GetProperty("id").GetInt32();
        var betaCode = beta.GetProperty("projectCode").GetString()!;
        Check(betaCode == "IT2611002", "Second generated code");
        var gammaBody = ProjectBody("Gamma");
        gammaBody["status"] = "COMPLETE";
        var gamma = await Expect(client, HttpMethod.Post, "/api/projects", gammaBody, HttpStatusCode.Created);
        var gammaId = gamma.GetProperty("id").GetInt32();
        Check(gamma.GetProperty("projectCode").GetString() == "IT2611003", "Third generated code");
        await AssertStatistics(client, 3, 1, 1, 1, 0);
        await Expect(client, HttpMethod.Get, $"/api/projects/{alphaId}", null, HttpStatusCode.OK);
        await Expect(client, HttpMethod.Get, "/api/projects/999999", null, HttpStatusCode.NotFound);

        var page = await List(client, "/api/projects?sortBy=projectName&sortDirection=asc&pageNumber=2&pageSize=1");
        Check(page.GetProperty("items")[0].GetProperty("projectName").GetString() == "Beta", "Sorted page content");
        Check(page.GetProperty("totalCount").GetInt32() == 3 && page.GetProperty("totalPages").GetInt32() == 3, "Paging totals");
        Check(page.GetProperty("hasPreviousPage").GetBoolean() && page.GetProperty("hasNextPage").GetBoolean(), "Paging links");
        await Count(client, "/api/projects?status=PENDING&status=HOLD", 2);
        await Count(client, "/api/projects?search=Alpha", 1);
        await Count(client, "/api/projects?search=%27%20OR%201%3D1--", 0);
        await Count(client, $"/api/projects?projectCode={alphaCode}&projectName=lph&manager=An&requester=Binh&description=sample", 1);
        await Count(client, "/api/projects?startDateFrom=2026-01-01&startDateTo=2026-01-01&endDateFrom=2026-12-31&endDateTo=2026-12-31", 3);
        await Count(client, "/api/projects?startDateFrom=2027-01-01", 0);
        var created = Uri.EscapeDataString(alpha.GetProperty("createdDate").GetString()!);
        await Count(client, $"/api/projects?id={alphaId}&createdDateFrom={created}&createdDateTo={created}", 1);
        var beyond = await List(client, "/api/projects?pageNumber=100&pageSize=10");
        Check(beyond.GetProperty("items").GetArrayLength() == 0 && beyond.GetProperty("totalCount").GetInt32() == 3, "Out of range page");

        var task1 = await Expect(client, HttpMethod.Post, "/api/tasks", TaskBody(alphaCode, "Task A"), HttpStatusCode.Created);
        var taskId = task1.GetProperty("id").GetInt32();
        Check(task1.GetProperty("progress").GetInt32() == 0, "Task progress defaults to 0 percent");
        foreach (var invalidProgress in new object[] { -1, 101, 1.5, "invalid" })
        {
            var invalidTask = TaskBody(alphaCode, "Invalid progress");
            invalidTask["progress"] = invalidProgress;
            await Expect(client, HttpMethod.Post, "/api/tasks", invalidTask, HttpStatusCode.BadRequest);
            await Expect(client, HttpMethod.Put, $"/api/tasks/{taskId}", invalidTask, HttpStatusCode.BadRequest);
        }
        foreach (var validProgress in new[] { 0, 1, 45, 100 })
        {
            var progressBody = TaskBody(alphaCode, "Task A");
            progressBody["progress"] = validProgress;
            var updatedProgress = await Expect(client, HttpMethod.Put, $"/api/tasks/{taskId}", progressBody, HttpStatusCode.OK);
            Check(updatedProgress.GetProperty("progress").GetInt32() == validProgress, "Task progress saved");
            var readProgress = await List(client, $"/api/tasks/{taskId}");
            Check(readProgress.GetProperty("progress").GetInt32() == validProgress, "Task progress returned by GET");
        }
        var unchangedProgress = await Expect(client, HttpMethod.Put, $"/api/tasks/{taskId}", TaskBody(alphaCode, "Task A"), HttpStatusCode.OK);
        Check(unchangedProgress.GetProperty("progress").GetInt32() == 100, "Omitted progress preserves current value");
        var task2Body = TaskBody(alphaCode, "Task B");
        task2Body["status"] = "HOLD";
        var task2 = await Expect(client, HttpMethod.Post, "/api/tasks", task2Body, HttpStatusCode.Created);
        var task2Id = task2.GetProperty("id").GetInt32();
        await Count(client, $"/api/tasks?projectCode={alphaCode}&status=PENDING&status=HOLD&pic=An&description=sample", 2);
        await Count(client, "/api/tasks?taskName=Task%20A&search=sample", 1);
        await Count(client, "/api/tasks?startDateFrom=2026-01-01&endDateTo=2026-12-31", 2);
        var taskPage = await List(client, "/api/tasks?sortBy=taskName&sortDirection=desc&pageSize=1");
        Check(taskPage.GetProperty("items")[0].GetProperty("taskName").GetString() == "Task B", "Task sorting");
        // Equal sort keys must still produce disjoint pages.
        var tie1 = await List(client, "/api/tasks?sortBy=pic&pageSize=1&pageNumber=1");
        var tie2 = await List(client, "/api/tasks?sortBy=pic&pageSize=1&pageNumber=2");
        Check(tie1.GetProperty("items")[0].GetProperty("id").GetInt32() != tie2.GetProperty("items")[0].GetProperty("id").GetInt32(), "Stable ties");
        await AssertProjectProgress(client, alphaId, 2, 0, 50m);
        task2Body["status"] = "COMPLETE";
        task2Body["progress"] = 25;
        var completedTask = await Expect(client, HttpMethod.Put, $"/api/tasks/{task2Id}", task2Body, HttpStatusCode.OK);
        Check(completedTask.GetProperty("progress").GetInt32() == 100, "Completing a task automatically sets progress to 100");
        await AssertProjectProgress(client, alphaId, 2, 1, 100m);
        // A failure after deleting tasks must roll back both tables.
        await using (var command = connection.CreateCommand())
        {
            command.CommandText = "CREATE TRIGGER reject_project_delete BEFORE DELETE ON projects BEGIN SELECT RAISE(ABORT, 'Simulated deletion failure'); END;";
            await command.ExecuteNonQueryAsync();
        }
        try
        {
            await Expect(client, HttpMethod.Delete, $"/api/projects/{alphaId}", null, HttpStatusCode.InternalServerError);
            await AssertProjectProgress(client, alphaId, 2, 1, 100m);
            await Expect(client, HttpMethod.Get, $"/api/tasks/{taskId}", null, HttpStatusCode.OK);
            await Expect(client, HttpMethod.Get, $"/api/tasks/{task2Id}", null, HttpStatusCode.OK);
        }
        finally
        {
            await using var command = connection.CreateCommand();
            command.CommandText = "DROP TRIGGER reject_project_delete;";
            await command.ExecuteNonQueryAsync();
        }
        var renamed = ProjectBody("Alpha");
        renamed["projectCode"] = "NEW";
        await Expect(client, HttpMethod.Put, $"/api/projects/{alphaId}", renamed, HttpStatusCode.BadRequest);
        var update = ProjectBody("Alpha updated");
        update["status"] = "CANCEL";
        var updated = await Expect(client, HttpMethod.Put, $"/api/projects/{alphaId}", update, HttpStatusCode.OK);
        Check(updated.GetProperty("projectName").GetString() == "Alpha updated" && updated.GetProperty("status").GetString() == "CANCEL", "Project update");
        Check(updated.GetProperty("createdDate").GetString() == alpha.GetProperty("createdDate").GetString(), "CreatedDate preserved");
        Check(updated.GetProperty("totalTasks").GetInt32() == 2 && updated.GetProperty("completedTasks").GetInt32() == 1 && updated.GetProperty("progressPercent").GetDecimal() == 100m, "PUT returns live task progress after completing a task");
        await AssertStatistics(client, 3, 0, 1, 1, 1);
        await Expect(client, HttpMethod.Put, $"/api/tasks/{taskId}", TaskBody("MISSING", "Task moved"), HttpStatusCode.BadRequest);
        var moved = await Expect(client, HttpMethod.Put, $"/api/tasks/{taskId}", TaskBody(betaCode, "Task moved"), HttpStatusCode.OK);
        Check(moved.GetProperty("projectCode").GetString() == betaCode, "Task reassignment");
        await AssertProjectProgress(client, alphaId, 1, 1, 100m);
        await AssertProjectProgress(client, betaId, 1, 0, 100m);
        var completeMoved = TaskBody(betaCode, "Task moved");
        completeMoved["status"] = "COMPLETE";
        await Expect(client, HttpMethod.Put, $"/api/tasks/{taskId}", completeMoved, HttpStatusCode.OK);
        await AssertProjectProgress(client, betaId, 1, 1, 100m);
        await Expect(client, HttpMethod.Get, $"/api/tasks/{taskId}", null, HttpStatusCode.OK);
        await Expect(client, HttpMethod.Get, "/api/tasks/999999", null, HttpStatusCode.NotFound);
        await Expect(client, HttpMethod.Put, "/api/tasks/999999", TaskBody(alphaCode, "Missing"), HttpStatusCode.NotFound);
        await Expect(client, HttpMethod.Put, "/api/projects/999999", ProjectBody("Missing"), HttpStatusCode.NotFound);
        await Expect(client, HttpMethod.Delete, "/api/tasks/999999", null, HttpStatusCode.NotFound);
        await Expect(client, HttpMethod.Delete, "/api/projects/999999", null, HttpStatusCode.NotFound);
        var extraTask = await Expect(client, HttpMethod.Post, "/api/tasks", TaskBody(alphaCode, "Deleted with project"), HttpStatusCode.Created);
        await Expect(client, HttpMethod.Delete, $"/api/projects/{alphaId}", null, HttpStatusCode.NoContent);
        await Expect(client, HttpMethod.Get, $"/api/projects/{alphaId}", null, HttpStatusCode.NotFound);
        await Expect(client, HttpMethod.Get, $"/api/tasks/{task2Id}", null, HttpStatusCode.NotFound);
        await Expect(client, HttpMethod.Get, $"/api/tasks/{extraTask.GetProperty("id").GetInt32()}", null, HttpStatusCode.NotFound);
        await Expect(client, HttpMethod.Delete, $"/api/projects/{alphaId}", null, HttpStatusCode.NotFound);
        await Expect(client, HttpMethod.Get, $"/api/tasks/{taskId}", null, HttpStatusCode.OK);
        await AssertProjectProgress(client, betaId, 1, 1, 100m);
        await Expect(client, HttpMethod.Delete, $"/api/tasks/{taskId}", null, HttpStatusCode.NoContent);
        await AssertProjectProgress(client, betaId, 0, 0, 0m);
        await Count(client, "/api/tasks", 0);
        await AssertStatistics(client, 2, 0, 1, 1, 0);
        foreach (var id in new[] { betaId, gammaId })
        {
            await Expect(client, HttpMethod.Get, $"/api/projects/{id}", null, HttpStatusCode.OK);
            await Expect(client, HttpMethod.Delete, $"/api/projects/{id}", null, HttpStatusCode.NoContent);
        }
        await AssertStatistics(client, 0, 0, 0, 0, 0);
        await Count(client, "/api/projects", 0);
        await Count(client, "/api/tasks", 0);
        var empty = await List(client, "/api/projects");
        Check(empty.GetProperty("totalPages").GetInt32() == 0 && !empty.GetProperty("hasNextPage").GetBoolean(), "Empty pagination");
        using (var scope = factory.Services.CreateScope())
        {
            var generator = scope.ServiceProvider.GetRequiredService<ProjectCodeGenerator>();
            Check(await generator.ReserveAsync(default) == "IT2611004", "Deleted codes are never reissued");
            clock.UtcNow = new DateTimeOffset(2026, 11, 30, 17, 0, 0, TimeSpan.Zero);
            Check(await generator.ReserveAsync(default) == "IT2612001", "Month rollover at Vietnam midnight");
            Check(await generator.ReserveAsync(default) == "IT2612002", "New month increments");
            clock.UtcNow = new DateTimeOffset(2027, 1, 1, 0, 0, 0, TimeSpan.Zero);
            Check(await generator.ReserveAsync(default) == "IT2701001", "Year rollover");
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var counter = await db.Set<ProjectCodeCounter>().SingleAsync(c => c.Period == "2701");
            counter.LastNumber = 999;
            await db.SaveChangesAsync();
            Check(await generator.ReserveAsync(default) == "IT27011000", "Numbers beyond 999 expand");
            db.Projects.Add(new Project { ProjectCode = "IT2702007", ProjectName = "Existing project" });
            await db.SaveChangesAsync();
            clock.UtcNow = new DateTimeOffset(2027, 2, 1, 0, 0, 0, TimeSpan.Zero);
            Check(await generator.ReserveAsync(default) == "IT2702008", "Bootstrap from existing codes");
        }
        await VerifyEmployeeAssignments(client, factory.Services);
        await VerifyMultipleManagers(client);
        await VerifyDashboard(client, factory.Services);
        await VerifyProjectExcelExport(client, factory.Services);
        assertions += await BilingualVerification.Run(client, factory.Services);
        assertions += await DepartmentHierarchyVerification.Run(client, factory.Services);
        await VerifyExcelImportApi(client, factory.Services);
        await VerifyEditedImport(client, factory.Services);
        await VerifyConcurrentReservations();
        assertions += await DashboardVerification.Run(GetProjectRoot());
        assertions += await ActualDatesVerification.Run(GetProjectRoot());
        Console.WriteLine($"PASS: {assertions} assertions covering HTTP CRUD, validation, filters, paging, sorting, conflicts and SQL Server translation.");
    }

    private static async Task VerifyEditedImport(HttpClient client, IServiceProvider services)
    {
        var project = ProjectBody("Edited on preview 项目");
        project["manager"] = "#01959,#NEW888";
        project["description"] = "Edited description";
        var first = TaskBody("IGNORED", "Edited task");
        first["pic"] = "#NEW888";
        first["progress"] = 25;
        var added = TaskBody("IGNORED", "Added in preview");
        added["pic"] = "01959";
        added["status"] = "COMPLETE";
        added["progress"] = 0;
        var draft = new { project, tasks = new object[] { first, added } };
        var created = await Expect(client, HttpMethod.Post, "/api/projects/import/draft", draft, HttpStatusCode.Created);
        var id = created.GetProperty("id").GetInt32();
        Check(created.GetProperty("projectName").GetString() == "Edited on preview 项目" && created.GetProperty("description").GetString() == "Edited description", "Import persists edited project values without reading original file");
        Check(created.GetProperty("totalTasks").GetInt32() == 2 && created.GetProperty("progressPercent").GetDecimal() == 62.5m, "Edited and added tasks determine imported progress");
        using (var scope = services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var saved = await db.Projects.Include(p => p.Tasks).SingleAsync(p => p.Id == id);
            Check(saved.Manager == "01959,NEW888" && saved.Tasks.Any(task => task.TaskName == "Edited task" && task.PIC == "NEW888" && task.Progress == 25), "Edited draft normalizes hash codes and keeps unknown codes");
            Check(saved.Tasks.Single(task => task.TaskName == "Added in preview").Progress == 100, "Completed edited task defaults to 100 percent");
        }
        first["taskName"] = "";
        await Expect(client, HttpMethod.Post, "/api/projects/import/draft", draft, HttpStatusCode.BadRequest);
        first["taskName"] = "Edited task";
        first["pic"] = "OUTSIDE";
        await Expect(client, HttpMethod.Post, "/api/projects/import/draft", draft, HttpStatusCode.BadRequest);
        first["pic"] = "NEW888";
        first["endDate"] = "2025-01-01";
        await Expect(client, HttpMethod.Post, "/api/projects/import/draft", draft, HttpStatusCode.BadRequest);
        first["endDate"] = "2026-12-31";
        first["progress"] = 101;
        await Expect(client, HttpMethod.Post, "/api/projects/import/draft", draft, HttpStatusCode.BadRequest);
        await Expect(client, HttpMethod.Post, "/api/projects/import/draft", new { project, tasks = new object?[] { null } }, HttpStatusCode.BadRequest);
        using (var scope = services.CreateScope()) Check(await scope.ServiceProvider.GetRequiredService<ApplicationDbContext>().Projects.CountAsync(p => p.ProjectNameVi == "Edited on preview 项目") == 1, "Invalid edited drafts never save partial projects");
        await Expect(client, HttpMethod.Delete, $"/api/projects/{id}", null, HttpStatusCode.NoContent);
    }

    private static async Task VerifyExcelImportApi(HttpClient client, IServiceProvider services)
    {
        var templateBytes = ProjectExcelExporter.CreateLegacy(new ProjectManagement.Contracts.ProjectResponse(0,"","",null,null,null,WorkStatus.PENDING,null,null,default,default), [], new Dictionary<string,string>(), "vi", default, template: true);
        using var workbook = new XLWorkbook(new MemoryStream(templateBytes));
        var sheet = workbook.Worksheet("DuAn");
        Check(sheet.Cell(9,7).GetString() == "Ngày bắt đầu - 开始日期" && sheet.Cell(9,8).GetString() == "Ngày kết thúc - 结束日期", "Template has separate task dates");
        Check(sheet.ShowGridLines && sheet.Cell(9,2).Style.Border.BottomBorder != XLBorderStyleValues.None, "Template retains grid lines and cell borders");
        Check(sheet.Cell(3,3).IsEmpty(), "Template is blank, not copied from real project data");
        sheet.Cell(2,3).Value = "IT2611001";
        sheet.Cell(3,3).Value = "Import dự án 测试";
        sheet.Cell(4,3).Value = "#01959 - Ignore supplied name, #NEW999 - Unknown employee, 01959, #01959";
        sheet.Cell(4,6).Value = "Requester";
        sheet.Cell(5,3).Value = "01/11/2026 – 30/11/2026";
        sheet.Cell(6,3).Value = "Description 描述";
        sheet.Cell(10,2).Value = "Task one";
        sheet.Cell(10,4).Value = "#NEW999, #01959 - Name";
        sheet.Cell(10,5).Value = "PENDING";
        sheet.Cell(10,6).Value = 0.75;
        sheet.Cell(10,7).Value = new DateTime(2026,11,1);
        sheet.Cell(10,8).Value = new DateTime(2026,11,2);
        sheet.Cell(11,2).Value = "Task complete";
        sheet.Cell(11,4).Value = "NEW999";
        sheet.Cell(11,5).Value = "Đã hoàn thành - 已完成";
        sheet.Cell(11,6).Value = 0;
        var savedStreams = new List<MemoryStream>();
        byte[] Bytes() { var output = new MemoryStream(); savedStreams.Add(output); workbook.SaveAs(output); return output.ToArray(); }
        async Task<HttpResponseMessage> Send(string route, byte[] bytes, string fileName = "project.xlsx")
        {
            using var content = new MultipartFormDataContent();
            content.Add(new ByteArrayContent(bytes), "file", fileName);
            return await client.PostAsync(route, content);
        }
        async Task<int> CountProjects()
        { using var scope = services.CreateScope(); return await scope.ServiceProvider.GetRequiredService<ApplicationDbContext>().Projects.CountAsync(); }
        var before = await CountProjects();
        using (var preview = await Send("/api/projects/import/preview", Bytes()))
        {
            Check(preview.StatusCode == HttpStatusCode.OK, "Excel preview succeeds");
            var json = (await JsonDocument.ParseAsync(await preview.Content.ReadAsStreamAsync())).RootElement;
            Check(json.GetProperty("errors").GetArrayLength() == 0 && json.GetProperty("tasks").GetArrayLength() == 2, "Template blank rows are ignored and valid tasks parsed");
            Check(json.GetProperty("project").GetProperty("manager").GetString() == "01959,NEW999", "Hash-prefixed codes and staff labels normalize to distinct codes with leading zero preserved");
            Check(json.GetProperty("unknownCodes")[0].GetString() == "NEW999", "Unknown code reported without using supplied name");
            Check(json.GetProperty("tasks")[0].GetProperty("progress").GetInt32() == 75 && json.GetProperty("tasks")[1].GetProperty("progress").GetInt32() == 100, "Percentage import and completed task normalization");
        }
        Check(await CountProjects() == before, "Preview performs no writes");
        int importedId;
        string importedCode;
        using (var imported = await Send("/api/projects/import", Bytes()))
        {
            Check(imported.StatusCode == HttpStatusCode.Created, "Import creates project and tasks together");
            var json = (await JsonDocument.ParseAsync(await imported.Content.ReadAsStreamAsync())).RootElement;
            importedId = json.GetProperty("id").GetInt32();
            importedCode = json.GetProperty("projectCode").GetString()!;
            Check(importedCode != "IT2611001" && json.GetProperty("totalTasks").GetInt32() == 2, "Import reserves new code and ignores exported project code");
            Check(Math.Abs(json.GetProperty("progressPercent").GetDouble() - 87.5) < 0.001, "Imported tasks contribute to project progress");
        }
        using (var scope = services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            Check(!await db.ProjectUsers.AnyAsync(user => user.Code == "NEW999"), "Import never creates fake employees");
            var project = await db.Projects.Include(project => project.Tasks).SingleAsync(project => project.Id == importedId);
            Check(project.Manager == "01959,NEW999" && project.Tasks.Count == 2 && project.Tasks.Any(task => task.PIC == "NEW999,01959"), "Only codes are stored in project and task assignments");
        }
        using (var exported = new XLWorkbook(new MemoryStream(await client.GetByteArrayAsync($"/api/projects/{importedId}/export"))))
        {
            var manager = exported.Worksheet("DuAn").Cell(5,3).GetString();
            Check(manager.Contains("01959 - Đàm Đức Hải") && manager.EndsWith("NEW999"), "Known codes display directory names; unknown codes display code only");
        }
        await Expect(client, HttpMethod.Post, "/api/tasks", new { projectCode = importedCode, taskName = "Unknown manager assignment", pic = "NEW999" }, HttpStatusCode.Created);
        var goodProgress = sheet.Cell(10,6).Value;
        sheet.Cell(10,6).Value = 1.01;
        using (var invalid = await Send("/api/projects/import", Bytes())) Check(invalid.StatusCode == HttpStatusCode.BadRequest, "Commit revalidates progress instead of trusting preview");
        Check(await CountProjects() == before + 1, "Invalid import creates no partial project");
        sheet.Cell(10,6).Value = goodProgress;
        sheet.Cell(10,4).Value = "OUTSIDE";
        using (var invalid = await Send("/api/projects/import", Bytes())) Check(invalid.StatusCode == HttpStatusCode.BadRequest, "Task assignees must be project managers");
        sheet.Cell(10,4).Value = "NEW999";
        sheet.Cell(10,8).Value = new DateTime(2026,10,31);
        using (var invalid = await Send("/api/projects/import", Bytes())) Check(invalid.StatusCode == HttpStatusCode.BadRequest, "Import validates task dates");
        using (var invalid = await Send("/api/projects/import/preview", [1,2,3])) Check(invalid.StatusCode == HttpStatusCode.BadRequest, "Corrupt workbook returns validation problem");
        using (var invalid = await Send("/api/projects/import/preview", templateBytes, "project.xls")) Check(invalid.StatusCode == HttpStatusCode.BadRequest, "Unsupported workbook format rejected");
        await Expect(client, HttpMethod.Delete, $"/api/projects/{importedId}", null, HttpStatusCode.NoContent);
        foreach (var saved in savedStreams) saved.Dispose();
    }

    private static async Task VerifyProjectExcelExport(HttpClient client, IServiceProvider services)
    {
        int id;
        using (var scope = services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var project = new Project { ProjectCode = "EXPORT_TEST", ProjectName = "Dự án 项目", Manager = "01959,An", Requester = "Requester", StartDate = new DateOnly(2026,11,1) };
            for (var index = 0; index < 105; index++) project.Tasks.Add(new ProjectTask {
                ProjectCode = project.ProjectCode, TaskName = index == 1 ? "=SUM(1,2)" : $"Task {index:D3}",
                Description = index == 0 ? new string('X', 33000) : "Mô tả 内容", PIC = "01959,An", Progress = index % 101,
                StartDate = index == 1 ? new DateOnly(2026,11,1) : index == 2 ? null : new DateOnly(2026,11,10)
            });
            db.Projects.Add(project);
            await db.SaveChangesAsync();
            id = project.Id;
        }
        foreach (var language in new[] { "vi", "zh" })
        {
            using var response = await client.GetAsync($"/api/projects/{id}/export?language={language}");
            Check(response.StatusCode == HttpStatusCode.OK, "Project Excel download succeeds");
            Check(response.Content.Headers.ContentType?.MediaType == ProjectExcelExporter.ContentType, "Excel MIME type");
            Check(Uri.UnescapeDataString(response.Content.Headers.ContentDisposition?.FileNameStar ?? "").Contains("EXPORT_TEST - Dự án 项目.xlsx"), "Excel download filename");
            using var stream = new MemoryStream(await response.Content.ReadAsByteArrayAsync());
            using var workbook = new XLWorkbook(stream);
            var info = workbook.Worksheet("DuAn");
            var tasks = info;
            Check(workbook.Worksheets.Count == 1, "All project information and tasks stay in one sheet");
            Check(info.Cell(11, 3).GetString() == "Tên công việc - 任务名称", "Export labels are Vietnamese and Chinese together");
            Check(info.LastColumnUsed()!.ColumnNumber() == 12 && info.Column(12).IsHidden, "Actual date columns added without created or updated columns");
            Check(info.Cell(2,3).GetString() == "EXPORT_TEST" && info.Cell(3,3).GetString() == "Dự án 项目", "Project identity and bilingual data preserved");
            Check(info.Cell(5,3).GetString().Contains("01959 - Đàm Đức Hải"), "Employee codes preserve leading zeros and resolve names");
            Check(tasks.Cell(220, 1).GetDouble() == 105, "Export includes all 105 tasks beyond page size");
            Check(tasks.Cell(12,3).GetString() == "=SUM(1,2)" && !tasks.Cell(12,3).HasFormula, "User content is literal text, never an Excel formula");
            Check(tasks.Cell(12,8).GetDateTime() == new DateTime(2026,11,1) && tasks.Cell(220,8).IsEmpty(), "Separate task dates, start date sorting and blank dates");
            Check(Math.Abs(tasks.Cell(12,7).GetDouble() - 0.01) < 0.00001, "Excel percentage is numeric");
            Check(info.Cell(6,3).GetString() == "01/11/2026 – —", "Project dates share one cell and preserve missing end date");
            Check(info.SheetView.SplitRow == 0 && info.SheetView.SplitColumn == 0, "No frozen header or columns");
            Check(info.Cell(225,2).GetString().Length + info.Cell(226,2).GetString().Length == 33000, "Long descriptions preserved across overflow cells");
            using (var scope = services.CreateScope())
            {
                var directory = await scope.ServiceProvider.GetRequiredService<ApplicationDbContext>().ProjectUsers.ToDictionaryAsync(user => user.Code, user => user.Name);
                var draft = ProjectExcelImporter.Read(workbook, directory, CancellationToken.None);
                Check(draft.Errors.Count == 0 && draft.Tasks.Count == 105, "Export file is directly usable as import template");
                Check(draft.Tasks.Any(task => task.Description?.Length == 33000), "Import restores long descriptions from continuation rows");
            }
        }
        await Expect(client, HttpMethod.Get, $"/api/projects/{id}/export?language=invalid", null, HttpStatusCode.BadRequest);
        await Expect(client, HttpMethod.Get, "/api/projects/999999/export", null, HttpStatusCode.NotFound);
        using (var scope = services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            db.Tasks.RemoveRange(await db.Tasks.Where(task => task.ProjectCode == "EXPORT_TEST").ToListAsync());
            db.Projects.Remove(await db.Projects.SingleAsync(project => project.Id == id));
            await db.SaveChangesAsync();
        }
    }

    private static async Task VerifyMultipleManagers(HttpClient client)
    {
        var baseline = await List(client, "/api/projects/statistics");
        var body = ProjectBody("Multiple managers");
        body["manager"] = " An,01959,Chi,An, ";
        var project = await Expect(client, HttpMethod.Post, "/api/projects", body, HttpStatusCode.Created);
        var id = project.GetProperty("id").GetInt32();
        Check(project.GetProperty("manager").GetString() == "An,01959,Chi", "Manager codes normalized and deduplicated");
        var loaded = await List(client, $"/api/projects/{id}");
        Check(loaded.GetProperty("manager").GetString() == "An,01959,Chi", "Multiple managers persist through GET");
        await Count(client, $"/api/projects?id={id}&managerCodes=01959", 1);
        await Count(client, $"/api/projects?id={id}&managerCodes=Chi", 1);
        await Count(client, $"/api/projects?id={id}&managerCodes=1959", 0);
        await Count(client, $"/api/projects?id={id}&manager={Uri.EscapeDataString("Đàm Đức Hải")}", 1);
        await Count(client, $"/api/projects?id={id}&search={Uri.EscapeDataString("Trần Thị Chi")}", 1);
        var dashboard = await List(client, "/api/projects/statistics");
        Check(dashboard.GetProperty("totalProjects").GetInt32() == baseline.GetProperty("totalProjects").GetInt32() + 1, "Cards count jointly managed project only once");
        foreach (var code in new[] { "An", "01959", "Chi" })
        {
            var before = baseline.GetProperty("projectsByManager").EnumerateArray().Single(row => row.GetProperty("userCode").GetString() == code);
            var after = dashboard.GetProperty("projectsByManager").EnumerateArray().Single(row => row.GetProperty("userCode").GetString() == code);
            Check(after.GetProperty("totalProjects").GetInt32() == before.GetProperty("totalProjects").GetInt32() + 1, "Chart counts the project once for each manager");
        }
        body["manager"] = "An,UNKNOWN";
        await Expect(client, HttpMethod.Put, $"/api/projects/{id}", body, HttpStatusCode.BadRequest);
        body["manager"] = null;
        var cleared = await Expect(client, HttpMethod.Put, $"/api/projects/{id}", body, HttpStatusCode.OK);
        Check(cleared.GetProperty("manager").ValueKind == JsonValueKind.Null, "All managers can be cleared");
        var unassignedTask = TaskBody(project.GetProperty("projectCode").GetString()!, "Unassigned task");
        await Expect(client, HttpMethod.Post, "/api/tasks", unassignedTask, HttpStatusCode.BadRequest);
        unassignedTask["pic"] = null;
        await Expect(client, HttpMethod.Post, "/api/tasks", unassignedTask, HttpStatusCode.Created);
        await Expect(client, HttpMethod.Delete, $"/api/projects/{id}", null, HttpStatusCode.NoContent);
    }

    private static async Task VerifyDashboard(HttpClient client, IServiceProvider services)
    {
        var baseline = await List(client, "/api/projects/statistics");
        var projects = new[]
        {
            new Project { ProjectCode = "DASH01", ProjectName = "Before", Manager = "Chi", StartDate = new DateOnly(2026, 1, 31) },
            new Project { ProjectCode = "DASH02", ProjectName = "Start", Manager = "An", StartDate = new DateOnly(2026, 2, 1) },
            new Project { ProjectCode = "DASH03", ProjectName = "Middle", Manager = "An", StartDate = new DateOnly(2026, 2, 10), Status = WorkStatus.COMPLETE },
            new Project { ProjectCode = "DASH04", ProjectName = "End", Manager = "Chi", StartDate = new DateOnly(2026, 2, 28), Status = WorkStatus.HOLD },
            new Project { ProjectCode = "DASH05", ProjectName = "After", Manager = "An", StartDate = new DateOnly(2026, 3, 1), Status = WorkStatus.CANCEL },
            new Project { ProjectCode = "DASH06", ProjectName = "No date", Manager = "An" },
            new Project { ProjectCode = "DASH07", ProjectName = "Unassigned", StartDate = new DateOnly(2026, 2, 20), Status = WorkStatus.CANCEL },
            new Project { ProjectCode = "DASH08", ProjectName = "Legacy", Manager = "OLD", StartDate = new DateOnly(2026, 2, 15) },
        };
        using (var scope = services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            db.Projects.AddRange(projects);
            await db.SaveChangesAsync();
        }
        var all = await List(client, "/api/projects/statistics");
        Check(all.GetProperty("totalProjects").GetInt32() == baseline.GetProperty("totalProjects").GetInt32() + 8, "Unfiltered dashboard includes projects with no start date");
        var dashboard = await List(client, "/api/projects/statistics?startDateFrom=2026-02-01&startDateTo=2026-02-28");
        Check(dashboard.GetProperty("totalProjects").GetInt32() == 5, "Dashboard date range is inclusive and excludes undated projects");
        foreach (var (field, expected) in new[] { ("pendingProjects", 2), ("completeProjects", 1), ("holdProjects", 1), ("cancelProjects", 1) })
            Check(dashboard.GetProperty(field).GetInt32() == expected, "Filtered dashboard status totals: " + field);
        var managers = dashboard.GetProperty("projectsByManager").EnumerateArray().ToArray();
        Check(managers.Sum(row => row.GetProperty("totalProjects").GetInt32()) == 5, "Chart total reconciles with dashboard cards");
        Check(managers[0].GetProperty("userCode").GetString() == "An" && managers[0].GetProperty("totalProjects").GetInt32() == 2, "Managers sorted by descending total projects");
        Check(managers.Zip(managers.Skip(1)).All(pair => pair.First.GetProperty("totalProjects").GetInt32() >= pair.Second.GetProperty("totalProjects").GetInt32()), "All manager rows sorted descending");
        Check(managers.Single(row => row.GetProperty("userCode").GetString() == "01959").GetProperty("totalProjects").GetInt32() == 0, "Employees without projects retained with zero counts");
        Check(managers.Single(row => row.GetProperty("userCode").ValueKind == JsonValueKind.Null).GetProperty("totalProjects").GetInt32() == 1, "Unassigned projects remain visible");
        Check(managers.Single(row => row.GetProperty("userCode").GetString() == "OLD").GetProperty("totalProjects").GetInt32() == 1, "Legacy assignments are not silently omitted");
        foreach (var row in managers)
            Check(row.GetProperty("totalProjects").GetInt32() == new[] { "pendingProjects", "completeProjects", "holdProjects", "cancelProjects" }.Sum(field => row.GetProperty(field).GetInt32()), "Manager total equals stacked status counts");
        foreach (var range in new[] { "startDateFrom=2026-02-01&startDateTo=2026-02-01", "startDateFrom=2026-03-01", "startDateTo=2026-01-31" })
            Check((await List(client, "/api/projects/statistics?" + range)).GetProperty("totalProjects").GetInt32() == 1, "Boundary/single-sided dashboard range: " + range);
        var empty = await List(client, "/api/projects/statistics?startDateFrom=2030-01-01");
        Check(empty.GetProperty("totalProjects").GetInt32() == 0 && empty.GetProperty("projectsByManager").EnumerateArray().All(row => row.GetProperty("totalProjects").GetInt32() == 0), "Empty range returns zero cards and chart data");
        await Expect(client, HttpMethod.Get, "/api/projects/statistics?startDateFrom=2026-03-01&startDateTo=2026-02-01", null, HttpStatusCode.BadRequest);
        await Expect(client, HttpMethod.Get, "/api/projects/statistics?startDateFrom=invalid", null, HttpStatusCode.BadRequest);
        using (var scope = services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            db.Projects.RemoveRange(await db.Projects.Where(p => p.ProjectCode.StartsWith("DASH")).ToListAsync());
            await db.SaveChangesAsync();
        }
    }

    private static async Task VerifyEmployeeAssignments(HttpClient client, IServiceProvider services)
    {
        var users = await Expect(client, HttpMethod.Get, "/api/project-users", null, HttpStatusCode.OK);
        Check(users.GetArrayLength() == 3, "Employee directory returns all users");
        var employee = users.EnumerateArray().Single(u => u.GetProperty("code").GetString() == "01959");
        Check(employee.GetProperty("name").GetString() == "Đàm Đức Hải", "Employee name and leading-zero code preserved");
        foreach (var field in new[] { "manager" })
        {
            var invalid = ProjectBody("Invalid employee");
            invalid[field] = "01959 - Đàm Đức Hải";
            var error = await Expect(client, HttpMethod.Post, "/api/projects", invalid, HttpStatusCode.BadRequest);
            Check(error.GetProperty("errors").TryGetProperty("Manager", out _), "Assignment errors identify the field");
        }
        var body = ProjectBody("Employee assignments");
        body["manager"] = " 01959 ";
        var project = await Expect(client, HttpMethod.Post, "/api/projects", body, HttpStatusCode.Created);
        var id = project.GetProperty("id").GetInt32();
        var code = project.GetProperty("projectCode").GetString()!;
        Check(project.GetProperty("manager").GetString() == "01959", "Project responses contain only employee codes");
        Check(project.GetProperty("requester").GetString() == "Binh", "Requester remains free text");
        var taskBody = TaskBody(code, "Assigned task");
        taskBody["pic"] = "Chi";
        await Expect(client, HttpMethod.Post, "/api/tasks", taskBody, HttpStatusCode.BadRequest);
        taskBody["pic"] = "UNKNOWN";
        await Expect(client, HttpMethod.Post, "/api/tasks", taskBody, HttpStatusCode.BadRequest);
        taskBody["pic"] = "01959";
        var task = await Expect(client, HttpMethod.Post, "/api/tasks", taskBody, HttpStatusCode.Created);
        var taskId = task.GetProperty("id").GetInt32();
        Check(task.GetProperty("pic").GetString() == "01959", "Task stores employee code");
        taskBody["pic"] = " 01959, Chi,01959 ";
        await Expect(client, HttpMethod.Put, $"/api/tasks/{taskId}", taskBody, HttpStatusCode.BadRequest);
        body["manager"] = "01959,Chi";
        await Expect(client, HttpMethod.Put, $"/api/projects/{id}", body, HttpStatusCode.OK);
        task = await Expect(client, HttpMethod.Put, $"/api/tasks/{taskId}", taskBody, HttpStatusCode.OK);
        Check(task.GetProperty("pic").GetString() == "01959,Chi", "Task supports multiple normalized employee codes");
        await Count(client, $"/api/tasks?pic={Uri.EscapeDataString("Trần Thị Chi")}", 1);
        await Count(client, $"/api/tasks?search={Uri.EscapeDataString("Trần Thị Chi")}", 1);
        taskBody["pic"] = "01959,UNKNOWN";
        await Expect(client, HttpMethod.Put, $"/api/tasks/{taskId}", taskBody, HttpStatusCode.BadRequest);
        var name = Uri.EscapeDataString("Đàm Đức Hải");
        await Count(client, $"/api/projects?manager={name}", 1);
        await Count(client, $"/api/projects?search={name}", 1);
        await Count(client, "/api/projects?manager=01959", 1);
        await Count(client, $"/api/tasks?pic={name}", 1);
        await Count(client, $"/api/tasks?search={name}", 1);
        body["manager"] = "UNKNOWN";
        await Expect(client, HttpMethod.Put, $"/api/projects/{id}", body, HttpStatusCode.BadRequest);
        taskBody["pic"] = "01959 - Đàm Đức Hải";
        await Expect(client, HttpMethod.Put, $"/api/tasks/{taskId}", taskBody, HttpStatusCode.BadRequest);
        using (var scope = services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            Check((await db.Projects.SingleAsync(p => p.Id == id)).Manager == "01959,Chi", "Invalid write leaves existing assignments intact");
            var legacy = await db.Projects.SingleAsync(p => p.Id == id);
            legacy.Manager = "Legacy free-text name";
            await db.SaveChangesAsync();
        }
        body["manager"] = "Legacy free-text name";
        body["status"] = "COMPLETE";
        await Expect(client, HttpMethod.Put, $"/api/projects/{id}", body, HttpStatusCode.OK);
        body["manager"] = "01959";
        project = await Expect(client, HttpMethod.Put, $"/api/projects/{id}", body, HttpStatusCode.OK);
        taskBody["pic"] = "01959,Chi";
        taskBody["status"] = "COMPLETE";
        var legacyAssignment = await Expect(client, HttpMethod.Put, $"/api/tasks/{taskId}", taskBody, HttpStatusCode.OK);
        Check(legacyAssignment.GetProperty("progress").GetInt32() == 100, "Existing assignment can complete after manager list changes");
        taskBody["pic"] = "Chi";
        await Expect(client, HttpMethod.Put, $"/api/tasks/{taskId}", taskBody, HttpStatusCode.BadRequest);
        using (var scope = services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            Check((await db.Projects.SingleAsync(p => p.Id == id)).Manager == "01959", "Database stores code including leading zero");
            Check((await db.Tasks.SingleAsync(t => t.Id == taskId)).PIC == "01959,Chi", "Database task stores multiple employee codes without changes from invalid requests");
            Check(await db.ProjectUsers.CountAsync() == 3, "Assignments never create employee records");
        }
        await Expect(client, HttpMethod.Delete, $"/api/projects/{id}", null, HttpStatusCode.NoContent);
    }

    private static async Task AssertProjectProgress(HttpClient client, int id, int total, int completed, decimal percent)
    {
        var detail = await Expect(client, HttpMethod.Get, $"/api/projects/{id}", null, HttpStatusCode.OK);
        var page = await List(client, $"/api/projects?id={id}");
        foreach (var row in new[] { detail, page.GetProperty("items")[0] })
        {
            Check(row.GetProperty("totalTasks").GetInt32() == total, "Progress total task count");
            Check(row.GetProperty("completedTasks").GetInt32() == completed, "Progress complete task count");
            Check(row.GetProperty("progressPercent").GetDecimal() == percent, "Progress percentage");
        }
    }

    private static async Task VerifyApiErrors(HttpClient client, IServiceProvider services)
    {
        foreach (var (kind, status, code) in new[]
        {
            ("cancel", 408, "REQUEST_CANCELLED"), ("timeout", 504, "REQUEST_TIMEOUT"),
            ("validation", 400, "VALIDATION_ERROR"), ("concurrency", 409, "DATA_CONFLICT"),
            ("configuration", 503, "DATABASE_NOT_CONFIGURED"), ("large", 413, "BAD_REQUEST"),
            ("database", 500, "INTERNAL_ERROR"), ("unexpected", 500, "INTERNAL_ERROR")
        })
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, $"/__tests/errors/{kind}");
            request.Headers.Add("Origin", "http://localhost:5173");
            using var response = await client.SendAsync(request);
            var text = await response.Content.ReadAsStringAsync();
            Check((int)response.StatusCode == status, $"Error status: {kind}");
            Check(response.Content.Headers.ContentType?.MediaType == "application/problem+json", "Problem content type");
            var error = JsonDocument.Parse(text).RootElement;
            Check(error.GetProperty("code").GetString() == code, $"Error code: {kind}");
            Check(error.GetProperty("status").GetInt32() == status, "Problem status");
            Check(!string.IsNullOrEmpty(error.GetProperty("traceId").GetString()), "Error trace ID");
            Check(!text.Contains("sensitive-"), "No internal exception details");
            Check(response.Headers.GetValues("Access-Control-Allow-Origin").Single() == "http://localhost:5173", "CORS on handled exceptions");
        }
        var validation = await Expect(client, HttpMethod.Get, "/api/projects?pageSize=101", null, HttpStatusCode.BadRequest);
        Check(validation.GetProperty("code").GetString() == "VALIDATION_ERROR", "MVC validation enriched");
        var missing = await Expect(client, HttpMethod.Get, "/api/projects/999999", null, HttpStatusCode.NotFound);
        Check(missing.GetProperty("code").GetString() == "NOT_FOUND", "MVC problem enriched");
        var route = await Expect(client, HttpMethod.Get, "/api/missing-api-route", null, HttpStatusCode.NotFound);
        Check(route.GetProperty("code").GetString() == "NOT_FOUND", "Unmatched route problem");

        // A disconnected client cannot receive JSON: consume the cancellation, no error write.
        var context = new DefaultHttpContext { RequestServices = services };
        context.Response.Body = new MemoryStream();
        context.RequestAborted = new CancellationToken(canceled: true);
        var middleware = new ApiExceptionMiddleware(_ => Task.FromException(new OperationCanceledException()),
            NullLogger<ApiExceptionMiddleware>.Instance);
        await middleware.InvokeAsync(context);
        Check(context.Response.StatusCode == 499, "Disconnected request status");
        Check(context.Response.Body.Length == 0, "No response write after client disconnect");
        Check(context.RequestAborted.IsCancellationRequested, "Cancellation remains enabled");
    }

    private static async Task VerifyFrontendHosting(HttpClient client, string pathBase = "")
    {
        if (!File.Exists(Path.Combine(GetProjectRoot(), "wwwroot", "index.html")))
        {
            Console.WriteLine("Frontend hosting checks skipped: run npm run build in project_management_fe first.");
            return;
        }
        string? html = null;
        foreach (var path in new[] { "/", "/dashboard", "/project", "/other-client-route" })
        {
            using var response = await client.GetAsync(pathBase + path);
            html = await response.Content.ReadAsStringAsync();
            Check(response.StatusCode == HttpStatusCode.OK, "Frontend route: " + path);
            Check(response.Content.Headers.ContentType?.MediaType == "text/html" && html.Contains("id=\"root\""), "React HTML served for " + path);
            Check(response.Headers.CacheControl?.NoCache == true, "React entry point must revalidate: " + path);
        }
        var asset = System.Text.RegularExpressions.Regex.Match(html!, "src=\"([^\"]*/assets/[^\"]+\\.js)\"");
        Check(asset.Success, "Built React entry references a JavaScript asset");
        var assetPath = asset.Groups[1].Value;
        if (pathBase.Length > 0)
            Check(assetPath.StartsWith(pathBase + "/assets/"), "Built JavaScript includes IIS application prefix");
        using (var response = await client.GetAsync(pathBase + assetPath[assetPath.IndexOf("/assets/", StringComparison.Ordinal)..]))
        {
            Check(response.StatusCode == HttpStatusCode.OK, "Built JavaScript served from wwwroot");
            Check(response.Content.Headers.ContentType?.MediaType?.Contains("javascript") == true, "JavaScript has correct MIME type");
        }
        foreach (var path in new[] { "/api/not-a-real-route", "/health/not-a-real-route", "/openapi/missing", "/assets/missing", "/assets/missing.js" })
        {
            using var response = await client.GetAsync(pathBase + path);
            Check(response.StatusCode == HttpStatusCode.NotFound, "Reserved/missing asset route remains 404: " + path);
            Check(response.Content.Headers.ContentType?.MediaType == "application/problem+json", "Reserved route never returns React HTML: " + path);
        }
        using var request = new HttpRequestMessage(HttpMethod.Head, pathBase + "/project");
        using var head = await client.SendAsync(request);
        Check(head.StatusCode == HttpStatusCode.OK && (await head.Content.ReadAsByteArrayAsync()).Length == 0, "HEAD frontend route has no response body");
        await Expect(client, HttpMethod.Post, pathBase + "/project", null, HttpStatusCode.MethodNotAllowed);
    }

    private static async Task VerifyCors(HttpClient client)
    {
        const string origin = "http://localhost:5173";
        using (var request = new HttpRequestMessage(HttpMethod.Get, "/api/projects/statistics"))
        {
            request.Headers.Add("Origin", origin);
            using var response = await client.SendAsync(request);
            Check(response.StatusCode == HttpStatusCode.OK, "CORS statistics status");
            Check(response.Headers.GetValues("Access-Control-Allow-Origin").Single() == origin, "CORS exact frontend origin");
            Check(response.Headers.GetValues("Access-Control-Allow-Credentials").Single() == "true", "CORS credentials");
        }
        foreach (var method in new[] { "GET", "POST", "PUT", "DELETE" })
        {
            using var request = new HttpRequestMessage(HttpMethod.Options, "/api/projects");
            request.Headers.Add("Origin", origin);
            request.Headers.Add("Access-Control-Request-Method", method);
            request.Headers.Add("Access-Control-Request-Headers", "content-type,x-csrftoken");
            using var response = await client.SendAsync(request);
            Check(response.StatusCode == HttpStatusCode.NoContent, "CORS preflight status");
            Check(response.Headers.GetValues("Access-Control-Allow-Origin").Single() == origin, "CORS preflight origin");
            Check(string.Join(",", response.Headers.GetValues("Access-Control-Allow-Methods")).Contains(method), "CORS preflight method");
            var allowedHeaders = string.Join(",", response.Headers.GetValues("Access-Control-Allow-Headers"));
            Check(allowedHeaders.Contains("content-type", StringComparison.OrdinalIgnoreCase) &&
                  allowedHeaders.Contains("x-csrftoken", StringComparison.OrdinalIgnoreCase), "CORS JSON and CSRF headers");
        }
        using (var request = new HttpRequestMessage(HttpMethod.Options, "/api/projects"))
        {
            request.Headers.Add("Origin", "http://untrusted.example");
            request.Headers.Add("Access-Control-Request-Method", "POST");
            using var response = await client.SendAsync(request);
            Check(!response.Headers.Contains("Access-Control-Allow-Origin"), "CORS rejects unknown origin");
        }
        using (var request = new HttpRequestMessage(HttpMethod.Get, "/api/projects?pageSize=101"))
        {
            request.Headers.Add("Origin", origin);
            using var response = await client.SendAsync(request);
            Check(response.StatusCode == HttpStatusCode.BadRequest, "CORS validation status");
            Check(response.Headers.GetValues("Access-Control-Allow-Origin").Single() == origin, "CORS headers on validation errors");
        }
    }

    private static string GetProjectRoot([System.Runtime.CompilerServices.CallerFilePath] string sourcePath = "")
        => Path.GetDirectoryName(Path.GetDirectoryName(sourcePath))!;

    private static async Task AssertStatistics(HttpClient client, int total, int pending, int complete, int hold, int cancel)
    {
        var result = await Expect(client, HttpMethod.Get, "/api/projects/statistics", null, HttpStatusCode.OK);
        Check(result.GetProperty("totalProjects").GetInt32() == total, "Statistics total");
        Check(result.GetProperty("pendingProjects").GetInt32() == pending, "Statistics PENDING");
        Check(result.GetProperty("completeProjects").GetInt32() == complete, "Statistics COMPLETE");
        Check(result.GetProperty("holdProjects").GetInt32() == hold, "Statistics HOLD");
        Check(result.GetProperty("cancelProjects").GetInt32() == cancel, "Statistics CANCEL");
        Check(total == pending + complete + hold + cancel, "Statistics status sum");
    }

    private static async Task VerifyConcurrentReservations()
    {
        var path = Path.Combine(Path.GetTempPath(), $"project-codes-{Guid.NewGuid():N}.db");
        try
        {
            var services = new ServiceCollection();
            services.AddOptions();
            services.AddSingleton<TimeProvider>(new TestClock(new DateTimeOffset(2026, 11, 7, 0, 0, 0, TimeSpan.Zero)));
            services.AddScoped<ProjectCodeGenerator>();
            services.AddScoped<ApplicationDbContext>(_ => new TestDbContext(
                new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlite($"Data Source={path};Default Timeout=30;Pooling=False").Options));
            await using var provider = services.BuildServiceProvider();
            using (var scope = provider.CreateScope())
                await scope.ServiceProvider.GetRequiredService<ApplicationDbContext>().Database.EnsureCreatedAsync();
            var codes = await Task.WhenAll(Enumerable.Range(0, 8).Select(_ => Task.Run(async () =>
            {
                using var scope = provider.CreateScope();
                return await scope.ServiceProvider.GetRequiredService<ProjectCodeGenerator>().ReserveAsync(default);
            })));
            Check(codes.Distinct().Count() == 8, "Concurrent reservations are unique");
            Check(codes.Order().SequenceEqual(Enumerable.Range(1, 8).Select(i => $"IT2611{i:D3}")), "Concurrent sequence numbers");
        }
        finally
        {
            // Delete only this test's uniquely named temporary database files.
            foreach (var suffix in new[] { "", "-wal", "-shm" }) File.Delete(path + suffix);
        }
    }

    private static Dictionary<string, object?> ProjectBody(string name) => new()
    {
        ["projectName"] = name, ["description"] = "sample",
        ["manager"] = "An", ["requester"] = "Binh",
        ["startDate"] = "2026-01-01", ["endDate"] = "2026-12-31"
    };
    private static Dictionary<string, object?> TaskBody(string code, string name) => new()
    {
        ["projectCode"] = code, ["taskName"] = name, ["pic"] = "An", ["description"] = "sample",
        ["startDate"] = "2026-01-01", ["endDate"] = "2026-12-31"
    };
    private static void Check(bool condition, string message)
    {
        if (!condition) throw new Exception(message);
        assertions++;
    }
    private static async Task<JsonElement> Expect(HttpClient client, HttpMethod method, string path, object? body, HttpStatusCode expected)
    {
        using var request = new HttpRequestMessage(method, path);
        if (body != null) request.Content = JsonContent.Create(body);
        using var response = await client.SendAsync(request);
        var text = await response.Content.ReadAsStringAsync();
        Check(response.StatusCode == expected, $"{method} {path}: expected {expected}, got {response.StatusCode}: {text}");
        if (expected == HttpStatusCode.Created) Check(response.Headers.Location != null, "Location header");
        return string.IsNullOrWhiteSpace(text) ? default : JsonDocument.Parse(text).RootElement.Clone();
    }
    private static Task<JsonElement> List(HttpClient client, string path) => Expect(client, HttpMethod.Get, path, null, HttpStatusCode.OK);
    private static async Task Count(HttpClient client, string path, int expected)
    {
        var result = await List(client, path);
        Check(result.GetProperty("totalCount").GetInt32() == expected, $"Count mismatch: {path}");
    }
}

// Only the test host uses SQLite. The actual application continues to use SQL Server.
internal sealed class TestDbContext(DbContextOptions<ApplicationDbContext> options) : ApplicationDbContext(options)
{
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        foreach (var entity in modelBuilder.Model.GetEntityTypes())
        {
            foreach (var constraint in entity.GetCheckConstraints().ToArray())
                entity.RemoveCheckConstraint(constraint.Name!);
            foreach (var property in entity.GetProperties())
            {
                property.SetColumnType(null);
                if (property.Name is "CreatedDate" or "UpdatedDate")
                    property.SetDefaultValueSql("CURRENT_TIMESTAMP");
            }
        }
    }
}

internal sealed class TestClock(DateTimeOffset utcNow) : TimeProvider
{
    public DateTimeOffset UtcNow { get; set; } = utcNow;
    public override DateTimeOffset GetUtcNow() => UtcNow;
}
