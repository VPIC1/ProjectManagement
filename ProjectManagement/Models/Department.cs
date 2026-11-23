namespace ProjectManagement.Models;

/// <summary>Organizational node; integer ID keeps existing project links, GroupId identifies the source record.</summary>
public sealed class Department
{
    public int Id { get; set; }
    public string? NameVi { get; set; }
    public string? NameZh { get; set; }
    // Compatibility accessor only; the database stores exactly two name columns.
    [System.ComponentModel.DataAnnotations.Schema.NotMapped]
    public string Name { get => NameVi ?? NameZh ?? string.Empty; set => NameVi = value; }
    public string GroupId { get; set; } = string.Empty;
    public string GroupType { get; set; } = "Department";
    public string? GroupCode { get; set; }
    public bool IsActive { get; set; } = true;
    public int? ParentId { get; set; }
    public Department? Parent { get; set; }
    public ICollection<Department> Children { get; set; } = new List<Department>();
    // Sibling display order; parent links alone define the hierarchy.
    public int SortOrder { get; set; }
}
