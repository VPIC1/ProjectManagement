using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectManagement.Data;

namespace ProjectManagement.Controllers;

[ApiController]
[Route("api/project-users")]
public sealed class ProjectUsersController(ApplicationDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetList(CancellationToken cancellationToken)
    {
        var users = await db.ProjectUsers.AsNoTracking().OrderBy(u => u.Code)
            .Select(u => new { u.Id, u.Code, u.Name }).ToListAsync(cancellationToken);
        return Ok(users);
    }
}
