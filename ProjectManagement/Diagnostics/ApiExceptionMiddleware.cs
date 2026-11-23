using System.ComponentModel.DataAnnotations;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace ProjectManagement.Diagnostics;

/// <summary>Đổi lỗi thành ProblemDetails có traceId và tránh ghi lỗi cho request client chủ động hủy.</summary>
public sealed class ApiExceptionMiddleware(RequestDelegate next, ILogger<ApiExceptionMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (Exception exception)
        {
            // Cancellation is expected when the frontend aborts an obsolete request.
            if (context.RequestAborted.IsCancellationRequested)
            {
                logger.LogInformation("Client closed request {Method} {Path}; trace {TraceId}",
                    context.Request.Method, context.Request.Path, context.TraceIdentifier);
                if (!context.Response.HasStarted)
                    context.Response.StatusCode = StatusCodes.Status499ClientClosedRequest;
                return;
            }

            var failure = Map(exception);
            if (failure.Status >= 500)
                logger.LogError(exception, "API error {Code} at {Path}; trace {TraceId}",
                    failure.Code, context.Request.Path, context.TraceIdentifier);
            else
                logger.LogInformation("API request ended with {Code} at {Path}; trace {TraceId}",
                    failure.Code, context.Request.Path, context.TraceIdentifier);

            if (context.Response.HasStarted)
            {
                // Preserve the already-sent response instead of appending invalid JSON.
                context.Abort();
                return;
            }

            context.Response.Clear();
            await ApiErrorResponse.WriteAsync(context, failure.Status, failure.Title, failure.Detail, failure.Code);
        }
    }

    private static (int Status, string Code, string Title, string Detail) Map(Exception exception)
    {
        if (exception is OperationCanceledException)
            return (408, "REQUEST_CANCELLED", "Request cancelled", "The operation was cancelled before it completed.");
        if (exception is ValidationException validation)
            return (400, "VALIDATION_ERROR", "Invalid data", validation.Message);
        if (exception is BadHttpRequestException badRequest)
            return (badRequest.StatusCode, "BAD_REQUEST", "Invalid request", "The request could not be processed.");
        if (exception is DbUpdateConcurrencyException)
            return (409, "DATA_CONFLICT", "Data conflict", "The data changed during this request. Refresh and retry.");
        if (exception is DatabaseConfigurationException)
            return (503, "DATABASE_NOT_CONFIGURED", "Database unavailable", "The database connection has not been configured.");

        if (exception.GetBaseException() is SqlException sql)
        {
            var numbers = sql.Errors.Cast<SqlError>().Select(e => e.Number).ToHashSet();
            if (numbers.Contains(-2))
                return (504, "DATABASE_TIMEOUT", "Database timeout", "The database operation timed out. Try again later.");
            if (numbers.Overlaps([2601, 2627]))
                return (409, "DUPLICATE_DATA", "Data conflict", "A record with the same unique value already exists.");
            if (numbers.Contains(547))
                return (409, "REFERENCE_CONFLICT", "Data conflict", "The operation conflicts with related data or a database constraint.");
            if (numbers.Overlaps([2, 20, 53, 64, 233, 4060, 18456, 10928, 10929, 40197, 40501, 40613, 10053, 10054, 10060, 11001]))
                return (503, "DATABASE_UNAVAILABLE", "Database unavailable", "The database is temporarily unavailable. Try again later.");
        }
        if (exception is TimeoutException)
            return (504, "REQUEST_TIMEOUT", "Request timeout", "The operation timed out. Try again later.");

        return (500, "INTERNAL_ERROR", "Server error", "An unexpected error occurred. Contact support with the traceId.");
    }
}
