using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectManagement.Contracts;
using ProjectManagement.Data;
using ProjectManagement.Models;

namespace ProjectManagement.Controllers;

[ApiController]
[Route("api/tasks")]
public sealed class TasksController(ApplicationDbContext db, ILogger<TasksController> logger) : DatabaseControllerBase
{
    [HttpGet]
    public async Task<ActionResult<PagedResult<TaskResponse>>> GetList(
        [FromQuery] TaskListQuery filter, CancellationToken cancellationToken)
    {
        var query = db.Tasks.AsNoTracking().ApplyCommonFilters(filter);
        query = query.ContainsText("TaskName", filter.TaskName);
        query = query.ContainsUser(db.ProjectUsers, "PIC", filter.PIC, multiple: true);
        if (!string.IsNullOrWhiteSpace(filter.Search))
        {
            var term = filter.Search.Trim();
            query = query.Where(t => t.ProjectCode.Contains(term) || ((t.TaskNameVi != null && t.TaskNameVi.Contains(term)) || (t.TaskNameZh != null && t.TaskNameZh.Contains(term))) ||
                ((t.DescriptionVi != null && t.DescriptionVi.Contains(term)) || (t.DescriptionZh != null && t.DescriptionZh.Contains(term))) ||
                (t.PIC != null && t.PIC.Contains(term)) ||
                db.ProjectUsers.Any(u => t.PIC != null && ("," + t.PIC + ",").Contains("," + u.Code + ",") && u.Name.Contains(term)));
        }
        var totalCount = await query.CountAsync(cancellationToken);
        var items = await query.ApplyPaging(filter).Select(TaskResponse.Projection).ToListAsync(cancellationToken);
        return Ok(new PagedResult<TaskResponse>(items, filter.PageNumber, filter.PageSize, totalCount));
    }

    [HttpGet("{id:int:min(1)}")]
    public async Task<ActionResult<TaskResponse>> GetById(int id, CancellationToken cancellationToken)
    {
        var result = await db.Tasks.AsNoTracking().Where(e => e.Id == id)
            .Select(TaskResponse.Projection).SingleOrDefaultAsync(cancellationToken);
        return result is null ? MissingProblem("Task") : Ok(result);
    }

    [HttpPost]
    public async Task<ActionResult<TaskResponse>> Create(TaskWriteRequest request, CancellationToken cancellationToken)
    {
        var code = request.ProjectCode.Trim();
        var project = await db.Projects.AsNoTracking().SingleOrDefaultAsync(p => p.ProjectCode == code, cancellationToken);

        if (project is null)
            return Problem(statusCode: 400, title: "Invalid project", detail: "ProjectCode does not reference an existing project.");

        var item = new ProjectTask { ProjectCode = code };
        request.PIC = await ValidateUserCodesAsync(db, request.PIC, nameof(request.PIC), cancellationToken, project.Manager, label: "người thực hiện");
        ValidateProjectAssignees(request.PIC, project.Manager);
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        ApplyRequest(item, request);
        db.Tasks.Add(item);
        try
        {
            await db.SaveChangesAsync(cancellationToken);
            await db.Entry(item).ReloadAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (HasSqlError(exception, 547))
        {
            return ConflictProblem("The referenced project changed or was deleted. Refresh and retry.");
        }

        logger.LogInformation("Created Task {Id}", item.Id);
        return CreatedAtAction(nameof(GetById), new { id = item.Id }, ToResponse(item));
    }

    [HttpPut("{id:int:min(1)}")]
    public async Task<ActionResult<TaskResponse>> Update(int id, TaskWriteRequest request, CancellationToken cancellationToken)
    {
        var item = await db.Tasks.SingleOrDefaultAsync(e => e.Id == id, cancellationToken);
        if (item is null) return MissingProblem("Task");

        var code = request.ProjectCode.Trim();
        var project = await db.Projects.AsNoTracking().SingleOrDefaultAsync(p => p.ProjectCode == code, cancellationToken);
        if (project is null)
            return Problem(statusCode: 400, title: "Invalid project", detail: "ProjectCode does not reference an existing project.");
        request.PIC = await ValidateUserCodesAsync(db, request.PIC, nameof(request.PIC), cancellationToken, string.Join(',', new[] { item.PIC, project.Manager }.Where(value => !string.IsNullOrEmpty(value))), label: "người thực hiện");
        if (item.ProjectCode != code || request.PIC != item.PIC)
            ValidateProjectAssignees(request.PIC, project.Manager);
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        item.ProjectCode = code;

        ApplyRequest(item, request);
        // PUT also refreshes updated_date when values are unchanged.
        db.Entry(item).Property(e => e.UpdatedDate).IsModified = true;
        try
        {
            await db.SaveChangesAsync(cancellationToken);
            await db.Entry(item).ReloadAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            return MissingProblem("Task");
        }
        catch (DbUpdateException exception) when (HasSqlError(exception, 547))
        {
            return ConflictProblem("The referenced project changed or was deleted. Refresh and retry.");
        }

        logger.LogInformation("Updated Task {Id}", id);
        return Ok(ToResponse(item));
    }

    [HttpDelete("{id:int:min(1)}")]
    public async Task<IActionResult> Delete(int id, CancellationToken cancellationToken)
    {
        var item = await db.Tasks.SingleOrDefaultAsync(e => e.Id == id, cancellationToken);
        if (item is null) return MissingProblem("Task");

        db.Tasks.Remove(item);
        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            return MissingProblem("Task");
        }

        logger.LogInformation("Deleted Task {Id}", id);
        return NoContent();
    }

    private static readonly Func<ProjectTask, TaskResponse> ToResponse = TaskResponse.Projection.Compile();

    private void ValidateProjectAssignees(string? value, string? managers)
    {
        var allowed = (managers ?? "").Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        if ((value ?? "").Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries).Any(code => !allowed.Contains(code)))
            ModelState.AddModelError(nameof(TaskWriteRequest.PIC), "Người thực hiện phải thuộc danh sách người phụ trách của dự án.");
    }

    // COMPLETE luôn ghi 100%. Đổi sang trạng thái khác giữ tiến độ đã nhập nếu request không gửi lại.
    private static void ApplyRequest(ProjectTask item, TaskWriteRequest request)
    {
        LocalizedContent.Apply(item, request);
        item.PIC = request.PIC?.Trim();
        if (request.Status == WorkStatus.COMPLETE) item.Progress = 100;
        else if (request.Progress.HasValue) item.Progress = request.Progress.Value;
        // LocalizedContent đã cập nhật mô tả, không ghi đè bằng trường tương thích.
        item.Status = request.Status;
        item.StartDate = request.StartDate;
        item.EndDate = request.EndDate;
        item.ActualStartDate = request.ActualStartDate;
        item.ActualEndDate = request.ActualEndDate;
    }
}
