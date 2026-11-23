using ProjectManagement.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectManagement.Contracts;
using ProjectManagement.Data;
using ProjectManagement.Models;

namespace ProjectManagement.Controllers;

[ApiController]
[Route("api/projects")]
public sealed class ProjectsController(ApplicationDbContext db, ProjectCodeGenerator codeGenerator, ILogger<ProjectsController> logger, TimeProvider clock) : DatabaseControllerBase
{
    [HttpGet]
    public async Task<ActionResult<PagedResult<ProjectResponse>>> GetList(
        [FromQuery] ProjectListQuery filter, CancellationToken cancellationToken)
    {
        var query = db.Projects.AsNoTracking().ApplyCommonFilters(filter);
        if (filter.ActivityYear is int activityYear && filter.ActivityMonth is int activityMonth)
        {
            var monthStart = new DateOnly(activityYear, activityMonth, 1);
            var monthEnd = monthStart.AddMonths(1);
            var activityToday = Today;
            // OR returns each project once, even if it both starts and completes in the selected month.
            query = query.Where(p => (p.StartDate >= monthStart && p.StartDate < monthEnd) ||
                (p.Status == WorkStatus.COMPLETE && p.ActualEndDate >= monthStart && p.ActualEndDate < monthEnd && p.ActualEndDate <= activityToday));
        }
        query = query.FilterEmployeeCodes(filter.ManagerCodes);
        query = query.ContainsText("ProjectName", filter.ProjectName);
        query = query.ContainsUser(db.ProjectUsers, "Manager", filter.Manager, multiple: true);
        query = query.ContainsText("Requester", filter.Requester);
        if (!string.IsNullOrWhiteSpace(filter.Search))
        {
            var term = filter.Search.Trim();
            query = query.Where(p => p.ProjectCode.Contains(term) || ((p.ProjectNameVi != null && p.ProjectNameVi.Contains(term)) || (p.ProjectNameZh != null && p.ProjectNameZh.Contains(term))) ||
                ((p.DescriptionVi != null && p.DescriptionVi.Contains(term)) || (p.DescriptionZh != null && p.DescriptionZh.Contains(term))) ||
                (p.Manager != null && p.Manager.Contains(term)) ||
                (p.Requester != null && p.Requester.Contains(term)) ||
                db.ProjectUsers.Any(u => p.Manager != null && ("," + p.Manager + ",").Contains("," + u.Code + ",") && u.Name.Contains(term)));
        }
        var totalCount = await query.CountAsync(cancellationToken);
        var items = await query.ApplyPaging(filter).Select(ProjectResponse.Projection).ToListAsync(cancellationToken);
        var today = Today;
        return Ok(new PagedResult<ProjectResponse>(items.Select(item => item with { AsOfDate = today }).ToList(), filter.PageNumber, filter.PageSize, totalCount));
    }

    [HttpGet("statistics")]
    public async Task<ActionResult<ProjectStatisticsResponse>> GetStatistics(
        [FromQuery] ProjectStatisticsQuery filter, CancellationToken cancellationToken)
    {
        var query = db.Projects.AsNoTracking();
        if (filter.StartDateFrom.HasValue) query = query.Where(p => p.StartDate >= filter.StartDateFrom.Value);
        if (filter.StartDateTo.HasValue) query = query.Where(p => p.StartDate <= filter.StartDateTo.Value);
        // Cards count each project once; the chart counts it once for each assigned manager.
        var groups = await query.GroupBy(p => new { p.Manager, p.Status })
            .Select(group => new { group.Key.Manager, group.Key.Status, Count = group.Count() })
            .ToListAsync(cancellationToken);
        var counts = groups.GroupBy(row => row.Status).ToDictionary(g => g.Key, g => g.Sum(row => row.Count));
        var assignments = groups.SelectMany(row => (row.Manager ?? "")
            .Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries)
            .Distinct(StringComparer.OrdinalIgnoreCase).DefaultIfEmpty("")
            .Select(code => new { Manager = code, row.Status, row.Count }));
        var byManager = assignments.GroupBy(row => row.Manager)
            .ToDictionary(g => g.Key, g => g.GroupBy(row => row.Status).ToDictionary(s => s.Key, s => s.Sum(row => row.Count)));
        var users = await db.ProjectUsers.AsNoTracking().Select(u => new { u.Code, u.Name }).ToListAsync(cancellationToken);
        var names = users.ToDictionary(u => u.Code, u => u.Name);
        var managers = names.Keys.Concat(byManager.Keys).Distinct().Select(code =>
        {
            var values = byManager.GetValueOrDefault(code) ?? [];
            return new ProjectManagerStatisticsResponse(code.Length == 0 ? null : code,
                code.Length == 0 ? "Chưa phân công" : names.GetValueOrDefault(code, "Chưa có trong danh sách nhân viên"),
                values.Values.Sum(), values.GetValueOrDefault(WorkStatus.PENDING), values.GetValueOrDefault(WorkStatus.COMPLETE),
                values.GetValueOrDefault(WorkStatus.HOLD), values.GetValueOrDefault(WorkStatus.CANCEL));
        }).OrderByDescending(row => row.TotalProjects).ThenBy(row => row.UserCode, StringComparer.Ordinal).ToList();

        return Ok(new ProjectStatisticsResponse(
            counts.Values.Sum(),
            counts.GetValueOrDefault(WorkStatus.PENDING),
            counts.GetValueOrDefault(WorkStatus.COMPLETE),
            counts.GetValueOrDefault(WorkStatus.HOLD),
            counts.GetValueOrDefault(WorkStatus.CANCEL)) { ProjectsByManager = managers });
    }

    [HttpGet("{id:int:min(1)}")]
    public async Task<ActionResult<ProjectResponse>> GetById(int id, CancellationToken cancellationToken)
    {
        var result = await db.Projects.AsNoTracking().Where(e => e.Id == id)
            .Select(ProjectResponse.Projection).SingleOrDefaultAsync(cancellationToken);
        return result is null ? MissingProblem("Project") : Ok(result with { AsOfDate = Today });
    }

    [HttpGet("{id:int:min(1)}/export")]
    public async Task<IActionResult> Export(int id,
        [FromQuery, System.ComponentModel.DataAnnotations.RegularExpression("^(vi|zh)$")] string language = "vi",
        CancellationToken cancellationToken = default)
    {
        var project = await db.Projects.AsNoTracking().Where(p => p.Id == id)
            .Select(ProjectResponse.Projection).SingleOrDefaultAsync(cancellationToken);
        if (project is null) return MissingProblem("Project");
        var tasks = await db.Tasks.AsNoTracking().Where(t => t.ProjectCode == project.ProjectCode)
            .OrderBy(t => t.StartDate == null).ThenBy(t => t.StartDate).ThenBy(t => t.Id)
            .ToListAsync(cancellationToken);
        var users = await db.ProjectUsers.AsNoTracking().ToDictionaryAsync(u => u.Code, u => u.Name, cancellationToken);
        // Dùng cùng danh sách task cho thông tin tổng quan và danh sách công việc trong một sheet.
        project = project with { TotalTasks = tasks.Count, TaskProgressTotal = tasks.Sum(t => (long)t.Progress), TaskSchedules = tasks.Select(t => new TaskSchedule(t.StartDate, t.EndDate)).ToList(), AsOfDate = Today };
        // Use the complete path only when a name is ambiguous; normal exports stay concise.
        if (project.RequesterDepartmentId is int departmentId)
        {
            var directory = DepartmentDirectory.Create(await db.Departments.AsNoTracking().ToListAsync(cancellationToken));
            var department = directory.SingleOrDefault(d => d.Id == departmentId);
            if (department != null)
            {
                var label = department.DisplayName(language);
                var ambiguous = directory.Count(d => d.Selectable && d.DisplayName(language).Equals(label, StringComparison.OrdinalIgnoreCase)) > 1;
                project = project with { RequesterDepartmentName = ambiguous ? department.DisplayPath(language) : label };
            }
        }
        var bytes = ProjectExcelExporter.Create(project, tasks, users, language, cancellationToken);
        Response.Headers.CacheControl = "no-store";
        return File(bytes, ProjectExcelExporter.ContentType, ProjectExcelExporter.FileName(project));
    }

    [HttpPost]
    public async Task<ActionResult<ProjectResponse>> Create(ProjectWriteRequest request, CancellationToken cancellationToken)
    {
        request.Manager = await ValidateUserCodesAsync(db, request.Manager, nameof(request.Manager), cancellationToken, label: "người phụ trách");
        await ValidateRequesterDepartmentAsync(db, request.RequesterDepartmentId, cancellationToken);
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        var code = await codeGenerator.ReserveAsync(cancellationToken);

        var item = new Project { ProjectCode = code };
        ApplyRequest(item, request);
        db.Projects.Add(item);
        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (HasSqlError(exception, 2601, 2627))
        {
            return ConflictProblem("Generated project code conflicts with existing data. Retry the request.");
        }

        logger.LogInformation("Created Project {Id} with code {ProjectCode}", item.Id, item.ProjectCode);
        var response = await db.Projects.AsNoTracking().Where(p => p.Id == item.Id)
            .Select(ProjectResponse.Projection).SingleAsync(cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = item.Id }, response with { AsOfDate = Today });
    }

    [HttpPut("{id:int:min(1)}")]
    public async Task<ActionResult<ProjectResponse>> Update(int id, ProjectWriteRequest request, CancellationToken cancellationToken)
    {
        var item = await db.Projects.SingleOrDefaultAsync(e => e.Id == id, cancellationToken);
        if (item is null) return MissingProblem("Project");

        request.Manager = await ValidateUserCodesAsync(db, request.Manager, nameof(request.Manager), cancellationToken, item.Manager, label: "người phụ trách");
        await ValidateRequesterDepartmentAsync(db, request.RequesterDepartmentId, cancellationToken);
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        ApplyRequest(item, request);
        // PUT also refreshes updated_date when values are unchanged.
        db.Entry(item).Property(e => e.UpdatedDate).IsModified = true;
        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            return MissingProblem("Project");
        }

        logger.LogInformation("Updated Project {Id}", id);
        var response = await db.Projects.AsNoTracking().Where(p => p.Id == id)
            .Select(ProjectResponse.Projection).SingleAsync(cancellationToken);
        return Ok(response with { AsOfDate = Today });
    }

    [HttpDelete("{id:int:min(1)}")]
    public async Task<IActionResult> Delete(int id, CancellationToken cancellationToken)
    {
        var strategy = db.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync<IActionResult>(async () =>
        {
            // Retry the entire transaction. Untracked reads and bulk deletes leave no stale
            // entity state to reuse if a transient database failure rolls back an attempt.
            await using var transaction = await db.Database.BeginTransactionAsync(
                System.Data.IsolationLevel.Serializable, cancellationToken);
            var item = await db.Projects.AsNoTracking().SingleOrDefaultAsync(e => e.Id == id, cancellationToken);
            if (item is null) return MissingProblem("Project");

            var deletedTasks = await db.Tasks.Where(t => t.ProjectCode == item.ProjectCode)
                .ExecuteDeleteAsync(cancellationToken);
            var deletedProjects = await db.Projects.Where(p => p.Id == id).ExecuteDeleteAsync(cancellationToken);
            if (deletedProjects == 0) return MissingProblem("Project");
            await transaction.CommitAsync(cancellationToken);

            logger.LogInformation("Deleted Project {Id} with code {ProjectCode} and {TaskCount} tasks", id, item.ProjectCode, deletedTasks);
            return NoContent();
        });
    }

    private DateOnly Today => BusinessDate.Today(clock);

    private static void ApplyRequest(Project item, ProjectWriteRequest request)
    {
        LocalizedContent.Apply(item, request);
        item.Manager = request.Manager?.Trim();
        item.Requester = request.Requester?.Trim();
        if (request.HasRequesterDepartmentId)
            item.RequesterDepartmentId = request.RequesterDepartmentId;
        // LocalizedContent đã cập nhật mô tả, không ghi đè bằng trường tương thích.
        item.Status = request.Status;
        item.StartDate = request.StartDate;
        item.EndDate = request.EndDate;
        item.ActualStartDate = request.ActualStartDate;
        item.ActualEndDate = request.ActualEndDate;
    }
}
