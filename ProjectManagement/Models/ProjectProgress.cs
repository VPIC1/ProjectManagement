namespace ProjectManagement.Models;

public sealed record TaskSchedule(DateOnly? StartDate, DateOnly? EndDate);

public static class ProjectProgress
{
    /// <summary>Trung bình tiến độ của toàn bộ task, mỗi task có cùng trọng số.</summary>
    public static decimal ActualPercent(long progressTotal, int taskCount) => taskCount == 0 ? 0 :
        Math.Round(progressTotal / (decimal)taskCount, 1, MidpointRounding.AwayFromZero);

    // Ngày kết thúc đạt 100%; task bắt đầu và kết thúc cùng ngày cũng đạt 100% trong ngày đó.
    private static decimal? SchedulePercent(DateOnly? startDate, DateOnly? endDate, DateOnly today)
    {
        if (startDate is not DateOnly start || endDate is not DateOnly end || end < start) return null;
        if (today < start) return 0;
        if (today >= end) return 100;
        return (today.DayNumber - start.DayNumber) * 100m / (end.DayNumber - start.DayNumber);
    }

    public static decimal? PlannedPercent(DateOnly? startDate, DateOnly? endDate, WorkStatus status, DateOnly today)
    {
        var value = status == WorkStatus.CANCEL ? null : SchedulePercent(startDate, endDate, today);
        return value.HasValue ? Math.Round(value.Value, 1, MidpointRounding.AwayFromZero) : null;
    }

    // Match ProgressPercent's complete task population and equal task weights.
    // Missing/invalid dates make comparison unavailable instead of silently changing its denominator.
    public static decimal? PlannedTaskPercent(IReadOnlyList<TaskSchedule> tasks, WorkStatus status, DateOnly today)
    {
        if (status == WorkStatus.CANCEL || tasks.Count == 0) return null;
        decimal total = 0;
        foreach (var task in tasks)
        {
            var value = SchedulePercent(task.StartDate, task.EndDate, today);
            if (!value.HasValue) return null;
            total += value.Value;
        }
        return Math.Round(total / tasks.Count, 1, MidpointRounding.AwayFromZero);
    }
}
