using System.Linq.Expressions;
using System.Text.Json.Serialization;
using ProjectManagement.Models;

namespace ProjectManagement.Contracts;

public sealed record PagedResult<T>(IReadOnlyList<T> Items, int PageNumber, int PageSize, int TotalCount)
{
    public int TotalPages => (int)Math.Ceiling((double)TotalCount / PageSize);
    public bool HasPreviousPage => PageNumber > 1;
    public bool HasNextPage => PageNumber < TotalPages;
}

public sealed record ProjectResponse(
    int Id, string ProjectCode, string ProjectName, string? Description,
    string? Manager, string? Requester, WorkStatus Status,
    DateOnly? StartDate, DateOnly? EndDate, DateTime CreatedDate, DateTime UpdatedDate)
{
    public static readonly Expression<Func<Project, ProjectResponse>> Projection = p => new(
        p.Id, p.ProjectCode, p.ProjectNameVi ?? p.ProjectNameZh ?? "", p.DescriptionVi ?? p.DescriptionZh, p.Manager, p.Requester,
        p.Status, p.StartDate, p.EndDate, p.CreatedDate, p.UpdatedDate)
        {
            ProjectNameVi = p.ProjectNameVi, ProjectNameZh = p.ProjectNameZh,
            DescriptionVi = p.DescriptionVi, DescriptionZh = p.DescriptionZh,
            ActualStartDate = p.ActualStartDate, ActualEndDate = p.ActualEndDate,
            RequesterDepartmentId = p.RequesterDepartmentId,
            RequesterDepartmentName = p.RequesterDepartment == null ? null : (p.RequesterDepartment.NameVi ?? p.RequesterDepartment.NameZh),
            RequesterDepartmentNameVi = p.RequesterDepartment == null ? null : p.RequesterDepartment.NameVi,
            RequesterDepartmentNameZh = p.RequesterDepartment == null ? null : p.RequesterDepartment.NameZh,
            TaskSchedules = p.Tasks.Select(task => new TaskSchedule(task.StartDate, task.EndDate)).ToList(),
            TotalTasks = p.Tasks.Count,
            CompletedTasks = p.Tasks.Count(t => t.Status == WorkStatus.COMPLETE),
            TaskProgressTotal = p.Tasks.Sum(t => (long?)t.Progress) ?? 0
        };

    public string? DescriptionVi { get; init; }
    public string? DescriptionZh { get; init; }
    public DateOnly? ActualStartDate { get; init; }
    public DateOnly? ActualEndDate { get; init; }
    public string? ProjectNameVi { get; init; }
    public string? ProjectNameZh { get; init; }
    public int? RequesterDepartmentId { get; init; }
    public string? RequesterDepartmentName { get; init; }
    public string? RequesterDepartmentNameVi { get; init; }
    public string? RequesterDepartmentNameZh { get; init; }
    [JsonIgnore]
    public DateOnly AsOfDate { get; init; } = BusinessDate.Today(TimeProvider.System);
    [JsonIgnore] public IReadOnlyList<TaskSchedule> TaskSchedules { get; init; } = [];
    public decimal? PlannedProgressPercent => ProjectProgress.PlannedTaskPercent(TaskSchedules, Status, AsOfDate);
    public int TotalTasks { get; init; }
    public int CompletedTasks { get; init; }
    [JsonIgnore]
    public long TaskProgressTotal { get; init; }
    public decimal ProgressPercent => ProjectProgress.ActualPercent(TaskProgressTotal, TotalTasks);
}

public sealed record TaskResponse(
    int Id, string ProjectCode, string TaskName, string? Description, string? PIC,
    WorkStatus Status, DateOnly? StartDate, DateOnly? EndDate, DateTime CreatedDate, DateTime UpdatedDate, int Progress)
{
    public string? DescriptionVi { get; init; }
    public string? DescriptionZh { get; init; }
    public DateOnly? ActualStartDate { get; init; }
    public DateOnly? ActualEndDate { get; init; }
    public string? TaskNameVi { get; init; }
    public string? TaskNameZh { get; init; }
    public static readonly Expression<Func<ProjectTask, TaskResponse>> Projection = t => new(
        t.Id, t.ProjectCode, t.TaskNameVi ?? t.TaskNameZh ?? "", t.DescriptionVi ?? t.DescriptionZh, t.PIC,
        t.Status, t.StartDate, t.EndDate, t.CreatedDate, t.UpdatedDate, t.Progress)
        { TaskNameVi = t.TaskNameVi, TaskNameZh = t.TaskNameZh, DescriptionVi = t.DescriptionVi, DescriptionZh = t.DescriptionZh,
          ActualStartDate = t.ActualStartDate, ActualEndDate = t.ActualEndDate };
}

// Dashboard counts share the same inclusive project start-date range.
public sealed record ProjectStatisticsResponse(
    int TotalProjects, int PendingProjects, int CompleteProjects, int HoldProjects, int CancelProjects)
{
    public IReadOnlyList<ProjectManagerStatisticsResponse> ProjectsByManager { get; init; } = [];
}

public sealed record ProjectManagerStatisticsResponse(
    string? UserCode, string UserName, int TotalProjects, int PendingProjects,
    int CompleteProjects, int HoldProjects, int CancelProjects);
