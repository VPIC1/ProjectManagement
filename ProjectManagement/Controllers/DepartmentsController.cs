using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectManagement.Data;
using ProjectManagement.Services;

namespace ProjectManagement.Controllers;

[ApiController]
[Route("api/departments")]
public sealed class DepartmentsController(ApplicationDbContext db) : ControllerBase
{
    // Preserve the existing flat endpoint; add hierarchy metadata and full paths.
    [HttpGet]
    public async Task<IActionResult> GetList(CancellationToken cancellationToken)
        => Ok(DepartmentDirectory.Create(await db.Departments.AsNoTracking().ToListAsync(cancellationToken)));

    [HttpGet("tree")]
    public async Task<IActionResult> GetTree(CancellationToken cancellationToken)
        => Ok(DepartmentDirectory.Tree(DepartmentDirectory.Create(await db.Departments.AsNoTracking().ToListAsync(cancellationToken))));
}
