using System.Data;
using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using ProjectManagement.Data;
using ProjectManagement.Models;

namespace ProjectManagement.Services;

public sealed class ProjectCodeOptions
{
    public string TimeZoneId { get; set; } = "Asia/Ho_Chi_Minh";
}

/// <summary>Cấp mã ITyyMMnnn bằng bộ đếm có khóa, an toàn khi nhiều request tạo dự án đồng thời.</summary>
public sealed class ProjectCodeGenerator(
    IServiceScopeFactory scopeFactory, TimeProvider clock, IOptions<ProjectCodeOptions> options)
{
    public async Task<string> ReserveAsync(CancellationToken cancellationToken)
    {
        var local = TimeZoneInfo.ConvertTime(clock.GetUtcNow(), TimeZoneInfo.FindSystemTimeZoneById(options.Value.TimeZoneId));
        var period = local.ToString("yyMM", CultureInfo.InvariantCulture);
        const string codePrefix = "IT";
        var prefix = codePrefix + period;

        using var strategyScope = scopeFactory.CreateScope();
        var strategyDb = strategyScope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var strategy = strategyDb.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            // Use a fresh context on retries so rolled-back counter state is never reused.
            using var scope = scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);
            var counters = db.Set<ProjectCodeCounter>();
            var counter = db.Database.IsSqlServer()
                ? await counters.FromSqlInterpolated($"SELECT [prefix], [period], [last_number] FROM [dbo].[project_code_counters] WITH (UPDLOCK, HOLDLOCK) WHERE [prefix] = {codePrefix} AND [period] = {period}")
                    .SingleOrDefaultAsync(cancellationToken)
                : await counters.SingleOrDefaultAsync(c => c.Prefix == codePrefix && c.Period == period, cancellationToken);

            if (counter is null)
            {
                // Bootstrap only once per month; preserve codes created before this feature.
                var existingCodes = await db.Projects.AsNoTracking()
                    .Where(p => p.ProjectCode.StartsWith(prefix)).Select(p => p.ProjectCode)
                    .ToListAsync(cancellationToken);
                var lastNumber = existingCodes.Select(code =>
                    long.TryParse(code.AsSpan(prefix.Length), NumberStyles.None, CultureInfo.InvariantCulture, out var number)
                        ? number : 0).DefaultIfEmpty(0).Max();
                counter = new ProjectCodeCounter { Prefix = codePrefix, Period = period, LastNumber = lastNumber };
                counters.Add(counter);
            }

            counter.LastNumber = checked(counter.LastNumber + 1);
            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            // Reservation is durable before creating the project. Failed requests may leave gaps.
            return prefix + counter.LastNumber.ToString("D3", CultureInfo.InvariantCulture);
        });
    }
}
