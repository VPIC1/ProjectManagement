using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using ProjectManagement.Contracts;
using ProjectManagement.Models;

namespace ProjectManagement.Data;

public static class QueryExtensions
{
    public static IQueryable<Project> FilterEmployeeCodes(this IQueryable<Project> query, string[] managerCodes)
    {
        var managers = managerCodes.Select(code => code.Trim()).Distinct().ToArray();
        if (managers.Length > 0)
            query = query.Where(p => p.Manager != null &&
                managers.Any(code => ("," + p.Manager + ",").Contains("," + code + ",")));
        return query;
    }

    public static IQueryable<TEntity> ContainsUser<TEntity>(this IQueryable<TEntity> query,
        IQueryable<ProjectUser> users, string property, string? text, bool multiple = false) where TEntity : class
    {
        if (string.IsNullOrWhiteSpace(text)) return query;
        var term = text.Trim();
        return query.Where(e => EF.Property<string?>(e, property) != null &&
            (EF.Property<string>(e, property).Contains(term) ||
             users.Any(u => (multiple
                 ? ("," + EF.Property<string>(e, property) + ",").Contains("," + u.Code + ",")
                 : u.Code == EF.Property<string>(e, property)) && u.Name.Contains(term))));
    }

    public static IQueryable<TEntity> ApplyCommonFilters<TEntity>(this IQueryable<TEntity> query, ListQuery filter)
        where TEntity : class
    {
        if (filter.Id.HasValue)
            query = query.Where(e => EF.Property<int>(e, "Id") == filter.Id.Value);
        if (!string.IsNullOrWhiteSpace(filter.ProjectCode))
        {
            var code = filter.ProjectCode.Trim();
            query = query.Where(e => EF.Property<string>(e, "ProjectCode") == code);
        }
        query = query.ContainsText("Description", filter.Description);
        if (filter.Status.Length > 0)
            query = query.Where(e => filter.Status.Contains(EF.Property<WorkStatus>(e, "Status")));
        if (filter.StartDateFrom.HasValue)
            query = query.Where(e => EF.Property<DateOnly?>(e, "StartDate") >= filter.StartDateFrom.Value);
        if (filter.StartDateTo.HasValue)
            query = query.Where(e => EF.Property<DateOnly?>(e, "StartDate") <= filter.StartDateTo.Value);
        if (filter.EndDateFrom.HasValue)
            query = query.Where(e => EF.Property<DateOnly?>(e, "EndDate") >= filter.EndDateFrom.Value);
        if (filter.EndDateTo.HasValue)
            query = query.Where(e => EF.Property<DateOnly?>(e, "EndDate") <= filter.EndDateTo.Value);
        if (filter.ActualStartDateFrom.HasValue)
            query = query.Where(e => EF.Property<DateOnly?>(e, "ActualStartDate") >= filter.ActualStartDateFrom.Value);
        if (filter.ActualStartDateTo.HasValue)
            query = query.Where(e => EF.Property<DateOnly?>(e, "ActualStartDate") <= filter.ActualStartDateTo.Value);
        if (filter.ActualEndDateFrom.HasValue)
            query = query.Where(e => EF.Property<DateOnly?>(e, "ActualEndDate") >= filter.ActualEndDateFrom.Value);
        if (filter.ActualEndDateTo.HasValue)
            query = query.Where(e => EF.Property<DateOnly?>(e, "ActualEndDate") <= filter.ActualEndDateTo.Value);
        if (filter.CreatedDateFrom.HasValue)
            query = query.Where(e => EF.Property<DateTime>(e, "CreatedDate") >= filter.CreatedDateFrom.Value);
        if (filter.CreatedDateTo.HasValue)
            query = query.Where(e => EF.Property<DateTime>(e, "CreatedDate") <= filter.CreatedDateTo.Value);
        if (filter.UpdatedDateFrom.HasValue)
            query = query.Where(e => EF.Property<DateTime>(e, "UpdatedDate") >= filter.UpdatedDateFrom.Value);
        if (filter.UpdatedDateTo.HasValue)
            query = query.Where(e => EF.Property<DateTime>(e, "UpdatedDate") <= filter.UpdatedDateTo.Value);
        return query;
    }

    public static IQueryable<TEntity> ContainsText<TEntity>(this IQueryable<TEntity> query, string property, string? text)
        where TEntity : class
    {
        if (string.IsNullOrWhiteSpace(text)) return query;
        var term = text.Trim();
        if (property is "ProjectName" or "TaskName" or "Description")
            return query.ApplySearch(term, property + "Vi", property + "Zh");
        return query.Where(e => EF.Property<string?>(e, property) != null &&
                                EF.Property<string>(e, property).Contains(term));
    }

    public static IQueryable<TEntity> ApplySearch<TEntity>(this IQueryable<TEntity> query, string? search, params string[] properties)
        where TEntity : class
    {
        if (string.IsNullOrWhiteSpace(search)) return query;
        // Only server-defined property names are passed here. Values remain SQL parameters.
        var parameter = Expression.Parameter(typeof(TEntity), "e");
        var term = search.Trim();
        Expression? body = null;
        // Legacy query parameter names search both persisted language variants.
        var mapped = properties.SelectMany(name => name is "ProjectName" or "TaskName" or "Description"
            ? new[] { name + "Vi", name + "Zh" } : new[] { name });
        foreach (var name in mapped)
        {
            var property = Expression.Property(parameter, name);
            var contains = Expression.AndAlso(
                Expression.NotEqual(property, Expression.Constant(null, typeof(string))),
                Expression.Call(property, nameof(string.Contains), Type.EmptyTypes,
                    ((Expression<Func<string>>)(() => term)).Body));
            body = body == null ? contains : Expression.OrElse(body, contains);
        }
        return query.Where(Expression.Lambda<Func<TEntity, bool>>(body!, parameter));
    }

    public static IQueryable<TEntity> ApplyPaging<TEntity>(this IQueryable<TEntity> query, ListQuery filter)
        where TEntity : class
    {
        var property = filter.SortColumns[filter.SortBy];
        var parameter = Expression.Parameter(typeof(TEntity), "e");
        Expression key = property is "ProjectName" or "TaskName"
            ? Expression.Coalesce(Expression.Property(parameter, property + "Vi"), Expression.Property(parameter, property + "Zh"))
            : Expression.Property(parameter, property);
        var selector = Expression.Lambda(key, parameter);
        var method = filter.SortDirection.Equals("asc", StringComparison.OrdinalIgnoreCase)
            ? nameof(Queryable.OrderBy) : nameof(Queryable.OrderByDescending);
        var expression = Expression.Call(typeof(Queryable), method,
            [typeof(TEntity), key.Type], query.Expression, Expression.Quote(selector));
        var ordered = (IOrderedQueryable<TEntity>)query.Provider.CreateQuery<TEntity>(expression);
        // Id breaks ties so equal dates/names do not cause unstable page boundaries.
        return ordered.ThenBy(e => EF.Property<int>(e, "Id"))
            .Skip(checked((filter.PageNumber - 1) * filter.PageSize)).Take(filter.PageSize);
    }
}
