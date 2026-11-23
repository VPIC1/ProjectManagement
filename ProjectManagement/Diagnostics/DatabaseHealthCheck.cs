using Microsoft.Extensions.Diagnostics.HealthChecks;
using ProjectManagement.Data;

namespace ProjectManagement.Diagnostics;

public sealed class DatabaseHealthCheck(IServiceScopeFactory scopeFactory, ILogger<DatabaseHealthCheck> logger) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        try
        {
            using var scope = scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            if (await db.Database.CanConnectAsync(cancellationToken))
                return HealthCheckResult.Healthy();

            logger.LogWarning("SQL Server health check failed");
            return HealthCheckResult.Unhealthy("SQL Server is unavailable.");
        }
        catch (Exception exception) when (!cancellationToken.IsCancellationRequested)
        {
            logger.LogError(exception, "SQL Server health check failed");
            return HealthCheckResult.Unhealthy("SQL Server is unavailable.");
        }
    }
}
