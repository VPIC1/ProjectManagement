using System.ComponentModel.DataAnnotations;
using System.Linq.Expressions;
using System.Text.Json.Serialization;
using ProjectManagement.Models;

namespace ProjectManagement.Contracts;

public sealed class DashboardQuery
{
    [Range(1, 12)] public int? DueMonth { get; set; }
    [RegularExpression("^(all|complete|late|open)$")] public string DueStatus { get; set; } = "all";
    [Range(0, int.MaxValue)] public int? DepartmentId { get; set; }
    [Range(1900, 9998)] public int? Year { get; set; }
    [RegularExpression("^(active|all|complete|hold|cancel|late|soon|active-not-late|hold-not-late)$")] public string View { get; set; } = "active";
    [Range(1, 50)] public int ProjectPageSize { get; set; } = 5;
    [Range(1, 1000000)] public int ProjectPage { get; set; } = 1;
    [Range(1, 1000000)] public int ComparisonPage { get; set; } = 1;
    [RegularExpression("^(late|soon)$")] public string Attention { get; set; } = "late";
    [Range(1, 1000000)] public int AttentionPage { get; set; } = 1;
}

public sealed record DashboardProject(int Id, string ProjectCode, string ProjectName, WorkStatus Status, DateOnly? EndDate)
{
    public static readonly Expression<Func<Project, DashboardProject>> Projection = p => new(
        p.Id, p.ProjectCode, p.ProjectNameVi ?? p.ProjectNameZh ?? "", p.Status, p.EndDate)
    {
        ProjectNameVi = p.ProjectNameVi, ProjectNameZh = p.ProjectNameZh,
        StartDate = p.StartDate, ActualStartDate = p.ActualStartDate, ActualEndDate = p.ActualEndDate,
        TaskSchedules = p.Tasks.Select(task => new TaskSchedule(task.StartDate, task.EndDate)).ToList(),
        TotalTasks = p.Tasks.Count, ProgressTotal = p.Tasks.Sum(t => (long?)t.Progress) ?? 0
    };
    public string? ProjectNameVi { get; init; }
    public string? ProjectNameZh { get; init; }
    public DateOnly? StartDate { get; init; }
    public DateOnly? ActualStartDate { get; init; }
    public DateOnly? ActualEndDate { get; init; }
    [JsonIgnore] public DateOnly AsOfDate { get; init; }
    [JsonIgnore] public IReadOnlyList<TaskSchedule> TaskSchedules { get; init; } = [];
    public decimal? PlannedProgressPercent => ProjectProgress.PlannedTaskPercent(TaskSchedules, Status, AsOfDate);
    [JsonIgnore] public int TotalTasks { get; init; }
    [JsonIgnore] public long ProgressTotal { get; init; }
    public decimal ProgressPercent => ProjectProgress.ActualPercent(ProgressTotal, TotalTasks);
}

public sealed record DashboardSummary(int Total, int Pending, int Complete, int Hold, int Cancel, int Overdue, int DueSoon)
{
    public int MeasuredComplete { get; init; }
    public int OnTimeComplete { get; init; }
    public int LateComplete { get; init; }
    public int MissingActualEnd { get; init; }
    public int MaxOverdueDays { get; init; }
    public decimal? OnTimePercent => MeasuredComplete == 0 ? null : Math.Round(OnTimeComplete * 100m / MeasuredComplete, 1, MidpointRounding.AwayFromZero);
}
public sealed record DashboardMonth(int Month, int Started, int PlannedEnd)
{
    public int? ActualCompleted { get; init; }
    public int? OnTimeCompleted { get; init; }
    public int? LateCompleted { get; init; }
}
public sealed record DashboardStatusCounts(int Total, int Pending, int Complete, int Hold, int Cancel, int Overdue)
{
    public int PendingNotOverdue { get; init; }
    public int HoldNotOverdue { get; init; }
}

public sealed record DashboardResponse(int Year, DateOnly Today, DashboardSummary Summary,
    IReadOnlyList<DashboardMonth> Months, PagedResult<DashboardProject> Projects, PagedResult<DashboardProject> Attention)
{
    public DateTimeOffset GeneratedAt { get; init; }
    public DateTimeOffset? DataUpdatedAt { get; init; }
    public IReadOnlyList<DashboardDueMonth> DueMonths { get; init; } = [];
    public required DashboardStatusCounts Overview { get; init; }
    public required DashboardAttentionCounts AttentionSummary { get; init; }
    public required PagedResult<DashboardProject> Comparison { get; init; }
    public IReadOnlyList<DashboardDepartment> Departments { get; init; } = [];
}

public sealed record DashboardDueMonth(int Month, int Complete, int Overdue, int NotOverdue)
{
    public int Year { get; init; }
    public int Total => Complete + Overdue + NotOverdue;
}

public sealed record DashboardDepartment(int? Id, string? Name, int Count)
{
    public string? NameVi { get; init; }
    public string? NameZh { get; init; }
}
public sealed record DashboardAttentionCounts(int Overdue, int DueSoon);
