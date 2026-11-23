using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectManagement.Contracts;
using ProjectManagement.Data;
using ProjectManagement.Models;

namespace ProjectManagement.Controllers;

[ApiController]
[Route("api/projects/dashboard")]
public sealed class DashboardController(ApplicationDbContext db, TimeProvider clock) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<DashboardResponse>> Get([FromQuery] DashboardQuery filter, CancellationToken cancellationToken)
    {
        var today = BusinessDate.Today(clock);
        var year = filter.Year ?? today.Year;
        var from = new DateOnly(year, 1, 1);
        var until = from.AddYears(1);
        var nextWeek = today.AddDays(7);
        var allProjects = db.Projects.AsNoTracking();
        // Dự án đang mở thuộc năm đã bắt đầu hoặc các năm chuyển tiếp sau đó.
        // Khi thiếu ngày bắt đầu, dùng ngày kết thúc; thiếu cả hai chỉ đưa vào năm hiện tại.
        var annualPortfolio = allProjects.Where(p =>
            ((p.Status == WorkStatus.PENDING || p.Status == WorkStatus.HOLD) &&
                (p.StartDate < until || (p.StartDate == null &&
                    (p.EndDate < until || (p.EndDate == null && year == today.Year))))) ||
            ((p.Status == WorkStatus.COMPLETE || p.Status == WorkStatus.CANCEL) && p.EndDate >= from && p.EndDate < until));

        // Bảng phòng ban luôn hiển thị tổng của năm để có thể đổi bộ lọc trực tiếp trên biểu đồ.
        var departments = await annualPortfolio
            .GroupBy(p => new { p.RequesterDepartmentId, NameVi = p.RequesterDepartment == null ? null : p.RequesterDepartment.NameVi, NameZh = p.RequesterDepartment == null ? null : p.RequesterDepartment.NameZh })
            .OrderByDescending(g => g.Count()).ThenBy(g => g.Key.NameVi ?? g.Key.NameZh).ThenBy(g => g.Key.RequesterDepartmentId)
            .Select(g => new DashboardDepartment(g.Key.RequesterDepartmentId, g.Key.NameVi ?? g.Key.NameZh, g.Count()) { NameVi = g.Key.NameVi, NameZh = g.Key.NameZh })
            .ToListAsync(cancellationToken);

        IQueryable<Project> FilterDepartment(IQueryable<Project> query)
        {
            if (filter.DepartmentId is not int id) return query;
            int? departmentId = id == 0 ? null : id;
            return query.Where(p => p.RequesterDepartmentId == departmentId);
        }

        var source = FilterDepartment(annualPortfolio);
        var open = source.Where(p => p.Status == WorkStatus.PENDING || p.Status == WorkStatus.HOLD);
        var portfolio = FilterDepartment(annualPortfolio);
        var counts = await CountStatuses(portfolio, today, cancellationToken);
        var overview = filter.DepartmentId.HasValue ? await CountStatuses(annualPortfolio, today, cancellationToken) : counts;
        var late = open.Where(p => p.EndDate < today);
        var soon = open.Where(p => p.EndDate >= today && p.EndDate <= nextWeek);
        var completed = source.Where(p => p.Status == WorkStatus.COMPLETE && p.EndDate >= from && p.EndDate < until);
        var measured = await completed.Where(p => p.ActualEndDate != null).CountAsync(cancellationToken);
        var onTime = await completed.Where(p => p.ActualEndDate != null && p.ActualEndDate <= p.EndDate).CountAsync(cancellationToken);
        var oldestLateDate = await late.Select(p => p.EndDate).MinAsync(cancellationToken);
        var allOpen = annualPortfolio.Where(p => p.Status == WorkStatus.PENDING || p.Status == WorkStatus.HOLD);
        var allLate = allOpen.Where(p => p.EndDate < today);
        var allSoon = allOpen.Where(p => p.EndDate >= today && p.EndDate <= nextWeek);
        var attentionSummary = new DashboardAttentionCounts(overview.Overdue, await allSoon.CountAsync(cancellationToken));
        var summary = new DashboardSummary(counts.Total, counts.Pending, counts.Complete, counts.Hold,
            counts.Cancel, counts.Overdue, await soon.CountAsync(cancellationToken))
        {
            MeasuredComplete = measured,
            OnTimeComplete = onTime,
            LateComplete = measured - onTime,
            MissingActualEnd = counts.Complete - measured,
            MaxOverdueDays = oldestLateDate.HasValue ? today.DayNumber - oldestLateDate.Value.DayNumber : 0
        };

        // Biểu đồ tháng dùng ngày kế hoạch và ngày hoàn thành thực tế của dự án.
        var starts = await allProjects.Where(p => p.StartDate >= from && p.StartDate < until)
            .GroupBy(p => p.StartDate!.Value.Month).Select(g => new { Month = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Month, x => x.Count, cancellationToken);
        var ends = await allProjects.Where(p => p.Status != WorkStatus.CANCEL && p.EndDate >= from && p.EndDate < until)
            .GroupBy(p => p.EndDate!.Value.Month).Select(g => new { Month = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Month, x => x.Count, cancellationToken);
        var actual = await allProjects.Where(p => p.Status == WorkStatus.COMPLETE && p.ActualEndDate >= from && p.ActualEndDate < until && p.ActualEndDate <= today)
            .GroupBy(p => p.ActualEndDate!.Value.Month)
            .Select(g => new
            {
                Month = g.Key,
                Count = g.Count(),
                OnTime = g.Sum(p => p.EndDate != null && p.ActualEndDate <= p.EndDate ? 1 : 0),
                Late = g.Sum(p => p.EndDate != null && p.ActualEndDate > p.EndDate ? 1 : 0)
            })
            .ToDictionaryAsync(x => x.Month, cancellationToken);
        var months = Enumerable.Range(1, 12).Select(m =>
        {
            var month = new DashboardMonth(m, starts.GetValueOrDefault(m), ends.GetValueOrDefault(m));
            if (year > today.Year || (year == today.Year && m > today.Month)) return month;
            var result = actual.GetValueOrDefault(m);
            return month with { ActualCompleted = result?.Count ?? 0, OnTimeCompleted = result?.OnTime ?? 0, LateCompleted = result?.Late ?? 0 };
        }).ToList();

        // Mỗi dự án nằm trong đúng một nhóm theo hạn dự kiến; không tính dự án hủy/thiếu hạn.
        var dueSource = allProjects.Where(p => p.Status != WorkStatus.CANCEL && p.EndDate >= from && p.EndDate < until);
        // Năm hiện tại: tháng hiện tại và hai tháng trước, kể cả khi đi qua năm cũ.
        // Năm đã kết thúc: ba tháng cuối năm; năm tương lai không có dữ liệu xử lý.
        var dueUntil = year == today.Year ? new DateOnly(year, today.Month, 1).AddMonths(1) : until;
        var dueFrom = dueUntil.AddMonths(-3);
        var dueMonths = await allProjects.Where(p => year <= today.Year && p.Status != WorkStatus.CANCEL &&
                p.EndDate >= dueFrom && p.EndDate < dueUntil)
            .GroupBy(p => new { p.EndDate!.Value.Year, p.EndDate.Value.Month })
            .OrderBy(g => g.Key.Year).ThenBy(g => g.Key.Month)
            .Select(g => new DashboardDueMonth(g.Key.Month,
                g.Count(p => p.Status == WorkStatus.COMPLETE),
                g.Count(p => p.Status != WorkStatus.COMPLETE && p.EndDate < today),
                g.Count(p => p.Status != WorkStatus.COMPLETE && p.EndDate >= today))
            { Year = g.Key.Year })
            .ToListAsync(cancellationToken);

        // Mốc cập nhật bao gồm cả task, độc lập với trang danh sách đang tải.
        var reportSource = allProjects.Where(p => annualPortfolio.Select(a => a.Id).Contains(p.Id) ||
            (p.StartDate >= from && p.StartDate < until) ||
            (p.ActualEndDate >= from && p.ActualEndDate < until) || (p.EndDate >= from && p.EndDate < until) ||
            (year <= today.Year && p.EndDate >= dueFrom && p.EndDate < dueUntil));
        var projectUpdated = await reportSource.Select(p => (DateTime?)p.UpdatedDate).MaxAsync(cancellationToken);
        var taskUpdated = await reportSource.SelectMany(p => p.Tasks).Select(t => (DateTime?)t.UpdatedDate).MaxAsync(cancellationToken);
        var latestUpdate = new[] { projectUpdated, taskUpdated }.Max();
        // Existing updated_date values are wall-clock times of the local database/application server.
        DateTimeOffset? dataUpdatedAt = latestUpdate is DateTime value && value > DateTime.MinValue
            ? new DateTimeOffset(DateTime.SpecifyKind(value, DateTimeKind.Unspecified), TimeZoneInfo.Local.GetUtcOffset(value))
            : null;

        var progress = SelectProjects(source, portfolio, filter.View, today, nextWeek);
        if (filter.DueMonth is int dueMonth)
        {
            progress = dueSource.Where(p => p.EndDate!.Value.Month == dueMonth);
            progress = filter.DueStatus switch
            {
                "complete" => progress.Where(p => p.Status == WorkStatus.COMPLETE),
                "late" => progress.Where(p => p.Status != WorkStatus.COMPLETE && p.EndDate < today),
                "open" => progress.Where(p => p.Status != WorkStatus.COMPLETE && p.EndDate >= today),
                _ => progress
            };
        }
        var comparisonQuery = SelectProjects(annualPortfolio, annualPortfolio, filter.View, today, nextWeek);
        var projects = await Page(progress, filter.ProjectPage, filter.ProjectPageSize, today, cancellationToken);
        var comparison = await Page(comparisonQuery, filter.ComparisonPage, 5, today, cancellationToken);
        var attention = await Page(filter.Attention == "late" ? allLate : allSoon, filter.AttentionPage, 5, today, cancellationToken);
        Response.Headers.CacheControl = "no-store";
        return Ok(new DashboardResponse(year, today, summary, months, projects, attention)
        {
            GeneratedAt = clock.GetUtcNow(),
            DataUpdatedAt = dataUpdatedAt,
            DueMonths = dueMonths,
            Departments = departments,
            Overview = overview,
            AttentionSummary = attentionSummary,
            Comparison = comparison
        });
    }

    private static IQueryable<Project> SelectProjects(IQueryable<Project> source, IQueryable<Project> portfolio,
        string view, DateOnly today, DateOnly nextWeek)
    {
        var open = source.Where(p => p.Status == WorkStatus.PENDING || p.Status == WorkStatus.HOLD);
        return view switch
        {
            "active-not-late" => open.Where(p => p.Status == WorkStatus.PENDING && (p.EndDate == null || p.EndDate >= today)),
            "hold-not-late" => open.Where(p => p.Status == WorkStatus.HOLD && (p.EndDate == null || p.EndDate >= today)),
            "late" => open.Where(p => p.EndDate < today),
            "soon" => open.Where(p => p.EndDate >= today && p.EndDate <= nextWeek),
            "all" => portfolio,
            "complete" => portfolio.Where(p => p.Status == WorkStatus.COMPLETE),
            "hold" => portfolio.Where(p => p.Status == WorkStatus.HOLD),
            "cancel" => portfolio.Where(p => p.Status == WorkStatus.CANCEL),
            _ => open.Where(p => p.Status == WorkStatus.PENDING)
        };
    }

    private static async Task<DashboardStatusCounts> CountStatuses(IQueryable<Project> portfolio, DateOnly today, CancellationToken token)
    {
        var grouped = await portfolio.GroupBy(p => p.Status)
            .Select(group => new { Status = group.Key, Count = group.Count(), PastEnd = group.Count(p => p.EndDate < today) })
            .ToDictionaryAsync(group => group.Status, token);
        var pending = grouped.GetValueOrDefault(WorkStatus.PENDING);
        var hold = grouped.GetValueOrDefault(WorkStatus.HOLD);
        return new DashboardStatusCounts(grouped.Values.Sum(group => group.Count), pending?.Count ?? 0,
            grouped.GetValueOrDefault(WorkStatus.COMPLETE)?.Count ?? 0, hold?.Count ?? 0,
            grouped.GetValueOrDefault(WorkStatus.CANCEL)?.Count ?? 0, (pending?.PastEnd ?? 0) + (hold?.PastEnd ?? 0))
        {
            PendingNotOverdue = (pending?.Count ?? 0) - (pending?.PastEnd ?? 0),
            HoldNotOverdue = (hold?.Count ?? 0) - (hold?.PastEnd ?? 0)
        };
    }

    private static async Task<PagedResult<DashboardProject>> Page(IQueryable<Project> query, int page, int size, DateOnly today, CancellationToken token)
    {
        var count = await query.CountAsync(token);
        page = Math.Min(page, Math.Max(1, (int)Math.Ceiling(count / (double)size)));
        var rows = await query.OrderBy(p => p.EndDate == null).ThenBy(p => p.EndDate).ThenBy(p => p.Id)
            .Skip((page - 1) * size).Take(size).Select(DashboardProject.Projection).ToListAsync(token);
        return new PagedResult<DashboardProject>(rows.Select(p => p with { AsOfDate = today }).ToList(), page, size, count);
    }
}
