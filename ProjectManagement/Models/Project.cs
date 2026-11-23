using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectManagement.Models;

public class Project
{
    public int Id { get; set; }
    public string ProjectCode { get; set; } = string.Empty;
    // Compatibility accessor only; the database stores exactly VI and ZH.
    [NotMapped]
    public string ProjectName { get => LocalizedContent.First(ProjectNameVi, ProjectNameZh) ?? string.Empty; set => ProjectNameVi = LocalizedContent.First(value); }
    public string? ProjectNameVi { get; set; }
    public string? ProjectNameZh { get; set; }
    public string? DescriptionVi { get; set; }
    public string? DescriptionZh { get; set; }
    [NotMapped]
    public string? Description { get => LocalizedContent.First(DescriptionVi, DescriptionZh); set => DescriptionVi = LocalizedContent.First(value); }
    public string? Manager { get; set; }
    public string? Requester { get; set; }
    public int? RequesterDepartmentId { get; set; }
    public Department? RequesterDepartment { get; set; }
    public WorkStatus Status { get; set; } = WorkStatus.PENDING;
    public DateOnly? StartDate { get; set; }
    public DateOnly? EndDate { get; set; }
    public DateOnly? ActualStartDate { get; set; }
    public DateOnly? ActualEndDate { get; set; }
    public DateTime CreatedDate { get; set; }
    public DateTime UpdatedDate { get; set; }
    public ICollection<ProjectTask> Tasks { get; set; } = new List<ProjectTask>();
}
