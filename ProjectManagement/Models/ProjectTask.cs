using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectManagement.Models;

public class ProjectTask
{
    public int Id { get; set; }
    public string ProjectCode { get; set; } = string.Empty;
    // Compatibility accessor only; the database stores exactly VI and ZH.
    [NotMapped]
    public string TaskName { get => LocalizedContent.First(TaskNameVi, TaskNameZh) ?? string.Empty; set => TaskNameVi = LocalizedContent.First(value); }
    public string? TaskNameVi { get; set; }
    public string? TaskNameZh { get; set; }
    public string? DescriptionVi { get; set; }
    public string? DescriptionZh { get; set; }
    [NotMapped]
    public string? Description { get => LocalizedContent.First(DescriptionVi, DescriptionZh); set => DescriptionVi = LocalizedContent.First(value); }
    public string? PIC { get; set; }
    public int Progress { get; set; }
    public WorkStatus Status { get; set; } = WorkStatus.PENDING;
    public DateOnly? StartDate { get; set; }
    public DateOnly? EndDate { get; set; }
    public DateOnly? ActualStartDate { get; set; }
    public DateOnly? ActualEndDate { get; set; }
    public DateTime CreatedDate { get; set; }
    public DateTime UpdatedDate { get; set; }
    public Project Project { get; set; } = null!;
}
