using Microsoft.AspNetCore.Http;
using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectManagement.Diagnostics;

namespace ProjectManagement.ApiTests;

// Registered only by the integration test host; never part of the application assembly.
[ApiController]
[Route("__tests/errors")]
public sealed class ErrorProbeController : ControllerBase
{
    [HttpGet("{kind}")]
    public IActionResult Get(string kind) => kind switch
    {
        "cancel" => throw new OperationCanceledException("sensitive-cancellation-detail"),
        "timeout" => throw new TimeoutException("sensitive-timeout-detail"),
        "validation" => throw new ValidationException("StartDate is required."),
        "concurrency" => throw new DbUpdateConcurrencyException("sensitive-database-detail"),
        "configuration" => throw new DatabaseConfigurationException(),
        "large" => throw new BadHttpRequestException("sensitive-request-detail", 413),
        "database" => throw new DbUpdateException("sensitive-database-detail"),
        _ => throw new InvalidOperationException("sensitive-internal-detail")
    };
}
