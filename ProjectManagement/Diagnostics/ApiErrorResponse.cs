using System.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace ProjectManagement.Diagnostics;

public static class ApiErrorResponse
{
    public static void Enrich(ProblemDetails problem, HttpContext context)
    {
        problem.Instance ??= context.Request.Path;
        problem.Extensions.TryAdd("code", problem is ValidationProblemDetails ? "VALIDATION_ERROR" : problem.Status switch
        {
            400 => "BAD_REQUEST", 401 => "UNAUTHORIZED", 403 => "FORBIDDEN",
            404 => "NOT_FOUND", 405 => "METHOD_NOT_ALLOWED", 408 => "REQUEST_CANCELLED",
            409 => "DATA_CONFLICT", 413 => "PAYLOAD_TOO_LARGE", 415 => "UNSUPPORTED_MEDIA_TYPE",
            429 => "TOO_MANY_REQUESTS", 499 => "CLIENT_CLOSED_REQUEST",
            503 => "DATABASE_UNAVAILABLE", 504 => "REQUEST_TIMEOUT", _ => "INTERNAL_ERROR"
        });
        problem.Extensions.TryAdd("traceId", Activity.Current?.Id ?? context.TraceIdentifier);
    }

    public static async Task WriteAsync(HttpContext context, int status, string title, string detail, string? code = null)
    {
        if (context.Response.HasStarted) return;
        context.Response.StatusCode = status;
        if (context.RequestAborted.IsCancellationRequested) return;

        var problem = new ProblemDetails { Status = status, Title = title, Detail = detail };
        if (code is not null) problem.Extensions["code"] = code;
        Enrich(problem, context);
        try
        {
            await context.Response.WriteAsJsonAsync(problem, options: (System.Text.Json.JsonSerializerOptions?)null, contentType: "application/problem+json",
                cancellationToken: context.RequestAborted);
        }
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
        {
            // The client disconnected while the response was being written.
            if (!context.Response.HasStarted) context.Response.StatusCode = StatusCodes.Status499ClientClosedRequest;
        }
        catch (IOException)
        {
            // A closed transport cannot receive an error response.
            context.Abort();
        }
    }
}
