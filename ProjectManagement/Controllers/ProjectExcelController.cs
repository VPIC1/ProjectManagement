using System.IO.Compression;
using ClosedXML.Excel;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectManagement.Contracts;
using ProjectManagement.Data;
using ProjectManagement.Models;
using ProjectManagement.Services;

namespace ProjectManagement.Controllers;

[ApiController]
[Route("api/projects")]
public sealed class ProjectExcelController(ApplicationDbContext db, ProjectCodeGenerator codes, ILogger<ProjectExcelController> logger) : DatabaseControllerBase
{
    [HttpGet("template")]
    public IActionResult Template(CancellationToken token)
    {
        var project = new ProjectResponse(0, "", "", null, null, null, WorkStatus.PENDING, null, null, default, default);
        var bytes = ProjectExcelExporter.Create(project, [], new Dictionary<string, string>(), "vi", token, template: true);
        return File(bytes, ProjectExcelExporter.ContentType, "Mau-du-an.xlsx");
    }

    // Preview chỉ đọc và kiểm tra Excel. Chưa có bản ghi nào được tạo ở bước này.
    [HttpPost("import/preview")]
    [RequestSizeLimit(6 * 1024 * 1024)]
    public async Task<IActionResult> Preview(IFormFile file, CancellationToken token)
    {
        var draft = await Read(file, token);
        return draft is null ? ValidationProblem(ModelState) : Ok(draft);
    }

    [HttpPost("import")]
    [RequestSizeLimit(6 * 1024 * 1024)]
    public async Task<IActionResult> Import(IFormFile file, CancellationToken token)
    {
        var draft = await Read(file, token);
        if (draft is null) return ValidationProblem(ModelState);
        foreach (var issue in draft.Errors) ModelState.AddModelError($"Dòng {issue.Row} / 第{issue.Row}行", issue.Message);
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        return await Save(draft.Project, draft.Tasks, token);
    }

    // Kiểm tra lại bản nháp sau chỉnh sửa, không tin dữ liệu đã kiểm tra ở trình duyệt.
    [HttpPost("import/draft")]
    [RequestSizeLimit(6 * 1024 * 1024)]
    public async Task<IActionResult> ImportDraft(ProjectExcelImportRequest draft, CancellationToken token)
    {
        var users = await db.ProjectUsers.AsNoTracking().Select(user => user.Code).ToListAsync(token);
        string? Normalize(string? input, string field)
        {
            var codes = (input ?? "").Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries)
                .Select(value => value.StartsWith('#') ? value[1..].Trim() : value).ToArray();
            if (codes.Any(code => code.Length == 0 || code.Length > 50 || code.Any(char.IsWhiteSpace)))
                ModelState.AddModelError(field, "Mã nhân viên không hợp lệ. / 员工工号无效。");
            var normalized = codes.Select(code => users.FirstOrDefault(user => user.Equals(code, StringComparison.OrdinalIgnoreCase)) ?? code)
                .Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
            return normalized.Length == 0 ? null : string.Join(',', normalized);
        }
        draft.Project.Manager = Normalize(draft.Project.Manager, "project.manager");
        var managers = (draft.Project.Manager ?? "").Split(',').ToHashSet(StringComparer.OrdinalIgnoreCase);
        for (var index = 0; index < draft.Tasks.Count; index++)
        {
            var task = draft.Tasks[index];
            if (task is null) { ModelState.AddModelError($"tasks[{index}]", "Công việc không hợp lệ. / 任务无效。"); continue; }
            task.PIC = Normalize(task.PIC, $"tasks[{index}].pic");
            if ((task.PIC ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries).Any(code => !managers.Contains(code)))
                ModelState.AddModelError($"tasks[{index}].pic", "Người thực hiện phải thuộc danh sách người phụ trách của dự án. / 执行人员必须在项目负责人名单中。");
            if (task.Status == WorkStatus.COMPLETE) task.Progress = 100;
        }
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        return await Save(draft.Project, draft.Tasks, token);
    }

    private async Task<IActionResult> Save(ProjectWriteRequest request, IReadOnlyList<TaskWriteRequest> tasks, CancellationToken token)
    {
        await ValidateRequesterDepartmentAsync(db, request.RequesterDepartmentId, token);
        if (!ModelState.IsValid) return ValidationProblem(ModelState);

        var code = await codes.ReserveAsync(token);
        var project = new Project { ProjectCode = code, ProjectName = request.ProjectName.Trim(), Description = request.Description,
            Manager = request.Manager, Requester = request.Requester, RequesterDepartmentId = request.RequesterDepartmentId,
            Status = request.Status, StartDate = request.StartDate, EndDate = request.EndDate, ActualStartDate = request.ActualStartDate, ActualEndDate = request.ActualEndDate };
        foreach (var task in tasks) project.Tasks.Add(new ProjectTask { ProjectCode = code, TaskName = task.TaskName.Trim(),
            Description = task.Description, PIC = task.PIC, Status = task.Status, Progress = task.Progress ?? 0, StartDate = task.StartDate, EndDate = task.EndDate, ActualStartDate = task.ActualStartDate, ActualEndDate = task.ActualEndDate });
        LocalizedContent.Apply(project, request);
        foreach (var (item, input) in project.Tasks.Zip(tasks)) LocalizedContent.Apply(item, input);
        db.Projects.Add(project);
        // A single SaveChanges transaction commits the project and every task together.
        await db.SaveChangesAsync(token);
        logger.LogInformation("Imported Project {ProjectCode} with {TaskCount} tasks from Excel", code, tasks.Count);
        var response = await db.Projects.AsNoTracking().Where(p => p.Id == project.Id).Select(ProjectResponse.Projection).SingleAsync(token);
        return CreatedAtAction("GetById", "Projects", new { id = project.Id }, response);
    }

    private async Task<ProjectExcelDraft?> Read(IFormFile file, CancellationToken token)
    {
        if (file.Length == 0 || file.Length > 5 * 1024 * 1024 || !Path.GetExtension(file.FileName).Equals(".xlsx", StringComparison.OrdinalIgnoreCase))
        { ModelState.AddModelError("file", "Chọn tệp .xlsx không quá 5 MB. / 请选择不超过5 MB的xlsx文件。"); return null; }
        using var stream = new MemoryStream();
        await file.CopyToAsync(stream, token);
        stream.Position = 0;
        try
        {
            using (var zip = new ZipArchive(stream, ZipArchiveMode.Read, leaveOpen: true))
            {
                if (zip.Entries.Count > 1000 || zip.Entries.Sum(entry => entry.Length) > 30 * 1024 * 1024 ||
                    zip.Entries.Any(entry => entry.FullName.Contains("vbaProject", StringComparison.OrdinalIgnoreCase)))
                    throw new InvalidDataException("Workbook too large or contains macros");
            }
            stream.Position = 0;
            using var workbook = new XLWorkbook(stream);
            var users = await db.ProjectUsers.AsNoTracking().ToDictionaryAsync(u => u.Code, u => u.Name, token);
            var draft = ProjectExcelImporter.Read(workbook, users, token);
            if (workbook.Worksheet("DuAn").Cell("L1").GetString() == ProjectExcelBilingual.Marker)
            {
                var name = workbook.Worksheet("DuAn").Cell(9,3).GetString().Trim();
                if (name.Length > 0)
                {
                    var directory = DepartmentDirectory.Create(await db.Departments.AsNoTracking().ToListAsync(token));
                    var matches = directory.Where(d => d.Selectable &&
                        (DepartmentDirectory.MatchesName(d, name) ||
                         d.GroupId.Equals(name, StringComparison.OrdinalIgnoreCase) || (d.GroupCode != null && d.GroupCode.Equals(name, StringComparison.OrdinalIgnoreCase)))).ToList();
                    if (matches.Count != 1)
                    {
                        var message = matches.Count == 0 ? "Phòng ban không có trong danh mục đang hoạt động. / 部门不在有效清单中。"
                            : "Tên hoặc mã phòng ban bị trùng. Hãy nhập đầy đủ đường dẫn hoặc GROUP_ID. / 部门名称或代码重复，请填写完整路径或 GROUP_ID。";
                        draft = draft with { Errors = draft.Errors.Concat([new ExcelImportIssue(9, message)]).ToList() };
                    }
                    else draft.Project.RequesterDepartmentId = matches[0].Id;
                }
            }
            return draft;
        }
        catch (Exception exception) when (exception is not OperationCanceledException && exception is not Microsoft.Data.SqlClient.SqlException)
        {
            logger.LogWarning("Invalid Excel import: {ExceptionType}", exception.GetType().Name);
            ModelState.AddModelError("file", "Không đọc được tệp Excel. Hãy dùng mẫu .xlsx hợp lệ, không đặt mật khẩu. / 无法读取Excel，请使用有效且未加密的xlsx模板。");
            return null;
        }
    }
}
