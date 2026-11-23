using Microsoft.EntityFrameworkCore;
using ProjectManagement.Data;

namespace ProjectManagement.Services;

public static class ProjectUserDirectory
{
    public static async Task<(bool IsValid, string? Code)> ResolveCodesAsync(ApplicationDbContext db, string? value,
        CancellationToken cancellationToken, string? previousValue = null)
    {
        var codes = (value ?? "").Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries)
            .Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        if (codes.Length == 0) return (true, null);
        var existingCodes = await db.ProjectUsers.AsNoTracking().Where(u => codes.Contains(u.Code))
            .Select(u => u.Code).ToListAsync(cancellationToken);
        var previousCodes = (previousValue ?? "").Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
        var resolved = codes.Select(code => existingCodes.Concat(previousCodes).FirstOrDefault(existing =>
            string.Equals(existing, code, StringComparison.OrdinalIgnoreCase))).ToArray();
        if (resolved.Any(code => code is null))
            return (value?.Trim() == previousValue?.Trim(), value?.Trim());
        return (true, string.Join(',', resolved.Distinct(StringComparer.OrdinalIgnoreCase)));
    }

    public static async Task<(bool IsValid, string? Code)> ResolveCodeAsync(ApplicationDbContext db, string? value,
        CancellationToken cancellationToken, string? previousValue = null)
    {
        var code = value?.Trim();
        if (string.IsNullOrEmpty(code)) return (true, null);
        var existingCode = await db.ProjectUsers.AsNoTracking().Where(u => u.Code == code)
            .Select(u => u.Code).FirstOrDefaultAsync(cancellationToken);
        if (existingCode is not null) return (true, existingCode);

        // Keep old free-text assignments editable until an employee is explicitly chosen.
        return (code == previousValue?.Trim(), code);
    }
}
