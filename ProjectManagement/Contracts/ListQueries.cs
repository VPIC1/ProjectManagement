using System.ComponentModel.DataAnnotations;
using ProjectManagement.Models;

namespace ProjectManagement.Contracts;

public abstract class ListQuery : IValidatableObject
{
    [Range(1, int.MaxValue)] public int PageNumber { get; set; } = 1;
    [Range(1, 100)] public int PageSize { get; set; } = 20;
    [StringLength(50)] public string SortBy { get; set; } = "createdDate";
    [RegularExpression("^(?i:asc|desc)$")] public string SortDirection { get; set; } = "desc";
    [Range(1, int.MaxValue)] public int? Id { get; set; }
    [StringLength(255)] public string? Search { get; set; }
    [StringLength(50)] public string? ProjectCode { get; set; }
    [StringLength(500)] public string? Description { get; set; }
    public WorkStatus[] Status { get; set; } = [];
    public DateOnly? StartDateFrom { get; set; }
    public DateOnly? StartDateTo { get; set; }
    public DateOnly? EndDateFrom { get; set; }
    public DateOnly? EndDateTo { get; set; }
    public DateOnly? ActualStartDateFrom { get; set; }
    public DateOnly? ActualStartDateTo { get; set; }
    public DateOnly? ActualEndDateFrom { get; set; }
    public DateOnly? ActualEndDateTo { get; set; }
    public DateTime? CreatedDateFrom { get; set; }
    public DateTime? CreatedDateTo { get; set; }
    public DateTime? UpdatedDateFrom { get; set; }
    public DateTime? UpdatedDateTo { get; set; }

    internal abstract IReadOnlyDictionary<string, string> SortColumns { get; }

    public virtual IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (!SortColumns.ContainsKey(SortBy))
            yield return new ValidationResult($"SortBy must be one of: {string.Join(", ", SortColumns.Keys)}.", [nameof(SortBy)]);
        if ((long)(PageNumber - 1) * PageSize > int.MaxValue)
            yield return new ValidationResult("Requested page offset is too large.", [nameof(PageNumber)]);
        if (Status.Any(value => !Enum.IsDefined(value)))
            yield return new ValidationResult("Status must be PENDING, COMPLETE, HOLD or CANCEL.", [nameof(Status)]);
        if (StartDateFrom > StartDateTo)
            yield return new ValidationResult("StartDateTo must be on or after StartDateFrom.", [nameof(StartDateTo)]);
        if (EndDateFrom > EndDateTo)
            yield return new ValidationResult("EndDateTo must be on or after EndDateFrom.", [nameof(EndDateTo)]);
        if (ActualStartDateFrom > ActualStartDateTo || ActualEndDateFrom > ActualEndDateTo)
            yield return new ValidationResult("Khoảng ngày thực tế không hợp lệ. / 实际日期范围无效。", [nameof(ActualEndDateTo)]);
        if (CreatedDateFrom > CreatedDateTo)
            yield return new ValidationResult("CreatedDateTo must be on or after CreatedDateFrom.", [nameof(CreatedDateTo)]);
        if (UpdatedDateFrom > UpdatedDateTo)
            yield return new ValidationResult("UpdatedDateTo must be on or after UpdatedDateFrom.", [nameof(UpdatedDateTo)]);
    }

    protected static Dictionary<string, string> CommonSortColumns() => new(StringComparer.OrdinalIgnoreCase)
    {
        ["id"] = "Id", ["projectCode"] = "ProjectCode", ["status"] = "Status",
        ["startDate"] = "StartDate", ["endDate"] = "EndDate",
        ["actualStartDate"] = "ActualStartDate", ["actualEndDate"] = "ActualEndDate",
        ["createdDate"] = "CreatedDate", ["updatedDate"] = "UpdatedDate"
    };
}

public sealed class ProjectListQuery : ListQuery
{
    [Range(1900, 9998)] public int? ActivityYear { get; set; }
    [Range(1, 12)] public int? ActivityMonth { get; set; }
    [StringLength(255)] public string? ProjectName { get; set; }
    [StringLength(255)] public string? Manager { get; set; }
    [StringLength(255)] public string? Requester { get; set; }
    [MaxLength(100)] public string[] ManagerCodes { get; set; } = [];

    public override IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        foreach (var error in base.Validate(validationContext)) yield return error;
        if (ActivityYear.HasValue != ActivityMonth.HasValue)
            yield return new ValidationResult("ActivityYear and ActivityMonth must be provided together.", [nameof(ActivityYear), nameof(ActivityMonth)]);
        if (ManagerCodes.Any(code => string.IsNullOrWhiteSpace(code) || code.Trim().Length > 50))
            yield return new ValidationResult("Employee codes must contain 1 to 50 characters.", [nameof(ManagerCodes)]);
    }
    private static readonly Dictionary<string, string> Columns = BuildColumns();
    internal override IReadOnlyDictionary<string, string> SortColumns => Columns;
    private static Dictionary<string, string> BuildColumns()
    {
        var columns = CommonSortColumns();
        columns.Add("projectName", "ProjectName");
        columns.Add("manager", "Manager");
        columns.Add("requester", "Requester");
        return columns;
    }
}

public sealed class TaskListQuery : ListQuery
{
    [StringLength(255)] public string? TaskName { get; set; }
    [StringLength(255)] public string? PIC { get; set; }
    private static readonly Dictionary<string, string> Columns = BuildColumns();
    internal override IReadOnlyDictionary<string, string> SortColumns => Columns;
    private static Dictionary<string, string> BuildColumns()
    {
        var columns = CommonSortColumns();
        columns.Add("taskName", "TaskName");
        columns.Add("pic", "PIC");
        return columns;
    }
}
