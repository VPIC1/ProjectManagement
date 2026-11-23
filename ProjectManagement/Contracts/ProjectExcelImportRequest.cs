using System.ComponentModel.DataAnnotations;
namespace ProjectManagement.Contracts;

public sealed class ProjectExcelImportRequest
{
    [Required] public ProjectWriteRequest Project { get; set; } = new();
    [Required, MaxLength(5000)] public List<TaskWriteRequest> Tasks { get; set; } = [];
}
