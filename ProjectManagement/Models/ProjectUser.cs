namespace ProjectManagement.Models;

public sealed class ProjectUser
{
    public int Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
}
