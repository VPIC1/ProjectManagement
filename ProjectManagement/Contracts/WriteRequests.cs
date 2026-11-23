using System.Text.Json.Serialization;
using System.ComponentModel.DataAnnotations;
using ProjectManagement.Models;

namespace ProjectManagement.Contracts;

public abstract class WorkWriteRequest : IValidatableObject
{
    public string? Description { get; set; }
    private string? descriptionVi, descriptionZh;
    public string? DescriptionVi { get => descriptionVi; set { descriptionVi = value; HasLocalizedDescription = true; } }
    public string? DescriptionZh { get => descriptionZh; set { descriptionZh = value; HasLocalizedDescription = true; } }
    [JsonIgnore] public bool HasLocalizedDescription { get; private set; }
    [EnumDataType(typeof(WorkStatus))]
    public WorkStatus Status { get; set; } = WorkStatus.PENDING;
    public DateOnly? StartDate { get; set; }
    public DateOnly? EndDate { get; set; }
    public DateOnly? ActualStartDate { get; set; }
    public DateOnly? ActualEndDate { get; set; }

    public virtual IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (ActualStartDate.HasValue && ActualEndDate.HasValue && ActualEndDate < ActualStartDate)
            yield return new ValidationResult("Ngày kết thúc thực tế không được trước ngày bắt đầu thực tế. / 实际结束日期不能早于实际开始日期。", [nameof(ActualEndDate)]);
        if (StartDate.HasValue && EndDate.HasValue && EndDate < StartDate)
            yield return new ValidationResult("EndDate must be on or after StartDate.", [nameof(EndDate)]);
    }
}

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed class ProjectWriteRequest : WorkWriteRequest
{
    [StringLength(255)]
    public string ProjectName { get; set; } = string.Empty;
    private string? nameVi, nameZh;
    [StringLength(255)] public string? ProjectNameVi { get => nameVi; set { nameVi = value; HasLocalizedName = true; } }
    [StringLength(255)] public string? ProjectNameZh { get => nameZh; set { nameZh = value; HasLocalizedName = true; } }
    [JsonIgnore] public bool HasLocalizedName { get; private set; }
    public override IEnumerable<ValidationResult> Validate(ValidationContext context)
    {
        foreach (var error in base.Validate(context)) yield return error;
        var name = HasLocalizedName ? LocalizedContent.First(ProjectNameVi, ProjectNameZh, ProjectName) : ProjectName;
        if (string.IsNullOrWhiteSpace(name))
            yield return new ValidationResult("The ProjectName field is required.", [nameof(ProjectNameVi), nameof(ProjectNameZh), nameof(ProjectName)]);
    }
    [StringLength(255)] public string? Manager { get; set; }
    [StringLength(255)] public string? Requester { get; set; }

    private int? requesterDepartmentId;
    [Range(1, int.MaxValue)]
    public int? RequesterDepartmentId
    {
        get => requesterDepartmentId;
        set
        {
            requesterDepartmentId = value;
            HasRequesterDepartmentId = true;
        }
    }

    internal bool HasRequesterDepartmentId { get; private set; }
}

public sealed class TaskWriteRequest : WorkWriteRequest
{
    [Required, StringLength(50)]
    public string ProjectCode { get; set; } = string.Empty;
    [StringLength(255)]
    public string TaskName { get; set; } = string.Empty;
    private string? nameVi, nameZh;
    [StringLength(255)] public string? TaskNameVi { get => nameVi; set { nameVi = value; HasLocalizedName = true; } }
    [StringLength(255)] public string? TaskNameZh { get => nameZh; set { nameZh = value; HasLocalizedName = true; } }
    [JsonIgnore] public bool HasLocalizedName { get; private set; }
    public override IEnumerable<ValidationResult> Validate(ValidationContext context)
    {
        foreach (var error in base.Validate(context)) yield return error;
        var name = HasLocalizedName ? LocalizedContent.First(TaskNameVi, TaskNameZh, TaskName) : TaskName;
        if (string.IsNullOrWhiteSpace(name))
            yield return new ValidationResult("The TaskName field is required.", [nameof(TaskNameVi), nameof(TaskNameZh), nameof(TaskName)]);
    }
    [StringLength(255)] public string? PIC { get; set; }
    [Range(0, 100, ErrorMessage = "Tiến độ phải là số nguyên từ 0 đến 100.")]
    public int? Progress { get; set; }
}
