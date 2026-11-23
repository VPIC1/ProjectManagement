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

namespace ProjectManagement.ApiTests;

internal static class ActualDatesVerification
{
    public static async Task<int> Run(string root)
    {
        using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var factory = new WebApplicationFactory<global::Program>().WithWebHostBuilder(builder =>
        {
            builder.UseContentRoot(root).UseEnvironment("Development");
            builder.ConfigureServices(services =>
            {
                services.RemoveAll<ApplicationDbContext>();
                services.AddScoped<ApplicationDbContext>(_ => new TestDbContext(new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlite(connection).Options));
            });
        });
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://localhost") });
        using (var scope = factory.Services.CreateScope())
            await scope.ServiceProvider.GetRequiredService<ApplicationDbContext>().Database.EnsureCreatedAsync();
        var count = 0;
        void Check(bool value, string label) { if (!value) throw new Exception("Actual dates: " + label); count++; }
        async Task<JsonElement> Request(HttpMethod method, string url, object? body, HttpStatusCode expected)
        {
            using var request = new HttpRequestMessage(method, url);
            if (body != null) request.Content = JsonContent.Create(body);
            using var response = await client.SendAsync(request);
            Check(response.StatusCode == expected, url + ": " + await response.Content.ReadAsStringAsync());
            return (await response.Content.ReadFromJsonAsync<JsonElement>()).Clone();
        }
        var body = new Dictionary<string, object?> { ["projectName"] = "Actual date test", ["status"] = "PENDING",
            ["startDate"] = "2026-01-01", ["endDate"] = "2026-03-31", ["actualStartDate"] = "2026-01-04", ["actualEndDate"] = "2026-04-02" };
        var project = await Request(HttpMethod.Post, "/api/projects", body, HttpStatusCode.Created);
        var id = project.GetProperty("id").GetInt32();
        Check(project.GetProperty("actualStartDate").GetString() == "2026-01-04" && project.GetProperty("actualEndDate").GetString() == "2026-04-02", "project create and dates distinct from plan");
        var taskBody = new Dictionary<string, object?> { ["projectCode"] = project.GetProperty("projectCode").GetString(),
            ["taskName"] = "Task actual dates", ["progress"] = 50, ["startDate"] = "2026-01-01", ["endDate"] = "2026-01-08", ["actualStartDate"] = "2026-01-05", ["actualEndDate"] = "2026-01-10" };
        var task = await Request(HttpMethod.Post, "/api/tasks", taskBody, HttpStatusCode.Created);
        var taskId = task.GetProperty("id").GetInt32();
        Check(task.GetProperty("actualEndDate").GetString() == "2026-01-10", "task dates saved");
        var read = await Request(HttpMethod.Get, $"/api/projects/{id}", null, HttpStatusCode.OK);
        Check(read.GetProperty("actualEndDate").GetString() == "2026-04-02", "project detail response");
        var filtered = await Request(HttpMethod.Get, "/api/tasks?actualStartDateFrom=2026-01-05&actualStartDateTo=2026-01-05&sortBy=actualEndDate", null, HttpStatusCode.OK);
        Check(filtered.GetProperty("totalCount").GetInt32() == 1 && filtered.GetProperty("items")[0].GetProperty("actualStartDate").GetString() == "2026-01-05", "inclusive filters and list projection");
        var excluded = await Request(HttpMethod.Get, "/api/projects?actualEndDateTo=2026-04-01", null, HttpStatusCode.OK);
        Check(excluded.GetProperty("totalCount").GetInt32() == 0, "actual end filter independent from planned end");
        taskBody["actualEndDate"] = "2026-01-01";
        await Request(HttpMethod.Put, $"/api/tasks/{taskId}", taskBody, HttpStatusCode.BadRequest);
        body["actualEndDate"] = "2026-01-01";
        await Request(HttpMethod.Put, $"/api/projects/{id}", body, HttpStatusCode.BadRequest);
        await Request(HttpMethod.Get, "/api/projects?actualStartDateFrom=2026-02-01&actualStartDateTo=2026-01-01", null, HttpStatusCode.BadRequest);
        body["actualEndDate"] = "2026-04-02";
        body["projectName"] = "Updated";
        var updated = await Request(HttpMethod.Put, $"/api/projects/{id}", body, HttpStatusCode.OK);
        Check(updated.GetProperty("actualEndDate").GetString() == "2026-04-02", "project update keeps actual dates");

        using var export = await client.GetAsync($"/api/projects/{id}/export");
        using var stream = new MemoryStream(await export.Content.ReadAsByteArrayAsync());
        using var workbook = new XLWorkbook(stream);
        var sheet = workbook.Worksheet("DuAn");
        Check(sheet.Cell(6, 7).GetString() == "04/01/2026 – 02/04/2026", "project actual dates exported");
        Check(sheet.Cell(12, 10).GetDateTime() == new DateTime(2026, 1, 5) && sheet.Cell(12, 11).GetDateTime() == new DateTime(2026, 1, 10), "task actual dates exported as dates");
        Check(sheet.Cell(12, 9).GetDateTime() == new DateTime(2026, 1, 8), "planned end date stays separate from actual end date");
        async Task<JsonElement> Preview()
        {
            // ClosedXML giữ stream lần lưu trước để tái sử dụng workbook ở lần kiểm tra tiếp theo.
            var output = new MemoryStream(); workbook.SaveAs(output);
            using var form = new MultipartFormDataContent(); form.Add(new ByteArrayContent(output.ToArray()), "file", "actual.xlsx");
            using var response = await client.PostAsync("/api/projects/import/preview", form);
            Check(response.IsSuccessStatusCode, "preview succeeds");
            return (await response.Content.ReadFromJsonAsync<JsonElement>()).Clone();
        }
        var draft = await Preview();
        Check(draft.GetProperty("errors").GetArrayLength() == 0 && draft.GetProperty("project").GetProperty("actualEndDate").GetString() == "2026-04-02", "project Excel roundtrip");
        Check(draft.GetProperty("tasks")[0].GetProperty("actualEndDate").GetString() == "2026-01-10", "task Excel roundtrip");
        await Request(HttpMethod.Post, "/api/projects/import/draft", new { project = draft.GetProperty("project"), tasks = draft.GetProperty("tasks") }, HttpStatusCode.Created);
        // Mẫu đã xuất trước khi thêm ngày thực tế vẫn đọc được.
        sheet.Cell(6,7).Clear(); sheet.Range("J12:K13").Clear(XLClearOptions.Contents);
        var legacy = await Preview();
        Check(legacy.GetProperty("errors").GetArrayLength() == 0 && legacy.GetProperty("project").GetProperty("actualStartDate").ValueKind == JsonValueKind.Null && legacy.GetProperty("tasks")[0].GetProperty("actualEndDate").ValueKind == JsonValueKind.Null, "V2 clearing actual dates compatibility");
        taskBody["actualStartDate"] = null; taskBody["actualEndDate"] = null; taskBody["status"] = "COMPLETE";
        var cleared = await Request(HttpMethod.Put, $"/api/tasks/{taskId}", taskBody, HttpStatusCode.OK);
        Check(cleared.GetProperty("actualEndDate").ValueKind == JsonValueKind.Null && cleared.GetProperty("progress").GetInt32() == 100, "nullable actual dates and existing completion behavior");
        foreach (var (start, end) in new (string?, string?)[]
        {
            (null, "2026-04-02"), ("2026-01-04", null), (null, null)
        })
        {
            body["actualStartDate"] = start;
            body["actualEndDate"] = end;
            await Request(HttpMethod.Put, $"/api/projects/{id}", body, HttpStatusCode.OK);
            var savedProject = await Request(HttpMethod.Get, $"/api/projects/{id}", null, HttpStatusCode.OK);
            Check(savedProject.GetProperty("actualStartDate").GetString() == start &&
                savedProject.GetProperty("actualEndDate").GetString() == end, "project persists clearing either or both actual dates");

            taskBody["actualStartDate"] = start;
            taskBody["actualEndDate"] = end;
            await Request(HttpMethod.Put, $"/api/tasks/{taskId}", taskBody, HttpStatusCode.OK);
            var savedTask = await Request(HttpMethod.Get, $"/api/tasks/{taskId}", null, HttpStatusCode.OK);
            Check(savedTask.GetProperty("actualStartDate").GetString() == start &&
                savedTask.GetProperty("actualEndDate").GetString() == end, "completed task persists clearing either or both actual dates");
        }
        var simple = await Request(HttpMethod.Post, "/api/projects", new { projectName = "No dates" }, HttpStatusCode.Created);
        Check(simple.GetProperty("actualStartDate").ValueKind == JsonValueKind.Null, "existing clients may omit actual dates");
        return count;
    }
}
