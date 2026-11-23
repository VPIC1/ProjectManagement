using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using ProjectManagement.Contracts;
using ProjectManagement.Data;
using ProjectManagement.Services;

namespace ProjectManagement.Controllers;

public abstract class DatabaseControllerBase : ControllerBase
{
    protected async Task<string?> ValidateUserCodesAsync(ApplicationDbContext db, string? value,
        string field, CancellationToken cancellationToken, string? previousValue = null, string label = "người phụ trách")
    {
        var result = await ProjectUserDirectory.ResolveCodesAsync(db, value, cancellationToken, previousValue);
        if (!result.IsValid)
            ModelState.AddModelError(field, $"Vui lòng chọn {label} từ danh sách nhân viên; gửi các mã cách nhau bằng dấu phẩy.");
        return result.Code;
    }

    protected async Task<string?> ValidateUserCodeAsync(ApplicationDbContext db, string? value,
        string field, string label, CancellationToken cancellationToken, string? previousValue = null)
    {
        var result = await ProjectUserDirectory.ResolveCodeAsync(db, value, cancellationToken, previousValue);
        if (!result.IsValid)
            ModelState.AddModelError(field, $"Vui lòng chọn {label} từ danh sách nhân viên (chỉ gửi mã nhân viên).");
        return result.Code;
    }

    protected async Task ValidateRequesterDepartmentAsync(ApplicationDbContext db, int? id, CancellationToken cancellationToken)
    {
        if (id.HasValue && !await db.Departments.AnyAsync(d => d.Id == id.Value && d.IsActive && d.GroupType == "Department", cancellationToken))
            ModelState.AddModelError(nameof(ProjectWriteRequest.RequesterDepartmentId),
                "Vui lòng chọn phòng ban trong danh sách. / 請從清單中選擇部門。");
    }

    protected static bool HasSqlError(DbUpdateException exception, params int[] numbers)
        => exception.InnerException is SqlException sql && sql.Errors.Cast<SqlError>().Any(e => numbers.Contains(e.Number));

    protected ObjectResult ConflictProblem(string detail)
        => Problem(statusCode: StatusCodes.Status409Conflict, title: "Data conflict", detail: detail);

    protected ObjectResult MissingProblem(string resource)
        => Problem(statusCode: StatusCodes.Status404NotFound, title: "Not found", detail: $"{resource} was not found.");
}
