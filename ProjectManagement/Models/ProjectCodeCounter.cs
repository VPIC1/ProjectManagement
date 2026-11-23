namespace ProjectManagement.Models;

// Retained even when projects are deleted, so their codes cannot be reissued.
public sealed class ProjectCodeCounter
{
    public string Prefix { get; set; } = "IT";
    public string Period { get; set; } = string.Empty;
    public long LastNumber { get; set; }
}
