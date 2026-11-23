using ProjectManagement.Models;
using System.Text.Json.Serialization;

namespace ProjectManagement.Services;

public sealed record DepartmentDirectoryItem(int Id, string Name, int? ParentId, string GroupId,
    string GroupType, string? GroupCode, bool IsActive, int SortOrder, string Path)
{
    public string? NameVi { get; init; }
    public string? NameZh { get; init; }
    public string PathVi { get; init; } = "";
    public string PathZh { get; init; } = "";
    public string DisplayName(string language) => language == "zh" ? NameZh ?? NameVi ?? Name : NameVi ?? NameZh ?? Name;
    public string DisplayPath(string language) => language == "zh" ? PathZh : PathVi;
    public bool Selectable => IsActive && GroupType == "Department";
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public IReadOnlyList<DepartmentDirectoryItem>? Children { get; init; }
}

public static class DepartmentDirectory
{
    public static IReadOnlyList<DepartmentDirectoryItem> Create(IReadOnlyList<Department> departments)
    {
        var byId = departments.ToDictionary(row => row.Id);
        var paths = new Dictionary<(int, string), string>();
        var visiting = new HashSet<int>();
        string Path(Department node, string language)
        {
            if (paths.TryGetValue((node.Id, language), out var cached)) return cached;
            if (!visiting.Add(node.Id)) throw new InvalidOperationException("Department hierarchy contains a cycle.");
            var name = language == "zh" ? node.NameZh ?? node.NameVi ?? "" : node.NameVi ?? node.NameZh ?? "";
            var value = node.ParentId is int parent && byId.TryGetValue(parent, out var ancestor)
                ? Path(ancestor, language) + " / " + name : name;
            visiting.Remove(node.Id); paths[(node.Id, language)] = value; return value;
        }
        return departments.Where(row => row.IsActive).OrderBy(row => row.SortOrder).ThenBy(row => row.Id)
            .Select(row => new DepartmentDirectoryItem(row.Id, row.Name, row.ParentId, row.GroupId, row.GroupType,
                row.GroupCode, row.IsActive, row.SortOrder, Path(row, "vi"))
                { NameVi = row.NameVi, NameZh = row.NameZh, PathVi = Path(row, "vi"), PathZh = Path(row, "zh") }).ToList();
    }

    // Accept either translation, either full path, or the old combined Excel label.
    public static bool MatchesName(DepartmentDirectoryItem row, string input)
    {
        var prefixMatch = System.Text.RegularExpressions.Regex.Match(row.NameZh ?? "", @"[㐀-鿿]");
        var prefix = prefixMatch.Success ? row.NameZh![..prefixMatch.Index].Trim() : "";
        var vi = row.NameVi ?? "";
        var suffix = prefix.Length > 0 && vi.StartsWith(prefix + " ", StringComparison.OrdinalIgnoreCase) ? vi[(prefix.Length + 1)..] : vi;
        var legacy = ((row.NameZh ?? "") + " " + suffix).Trim();
        return new[] { row.NameVi, row.NameZh, row.Name, row.PathVi, row.PathZh, legacy }
            .Any(value => string.Equals(value, input, StringComparison.OrdinalIgnoreCase));
    }

    public static IReadOnlyList<DepartmentDirectoryItem> Tree(IReadOnlyList<DepartmentDirectoryItem> rows)
    {
        var ids = rows.Select(row => row.Id).ToHashSet();
        var children = rows.Where(row => row.ParentId.HasValue && ids.Contains(row.ParentId.Value))
            .ToLookup(row => row.ParentId!.Value);
        DepartmentDirectoryItem Node(DepartmentDirectoryItem row) => row with
        { Children = children[row.Id].OrderBy(child => child.SortOrder).ThenBy(child => child.Id).Select(Node).ToList() };
        return rows.Where(row => !row.ParentId.HasValue || !ids.Contains(row.ParentId.Value))
            .OrderBy(row => row.GroupType == "Group").ThenBy(row => row.SortOrder).ThenBy(row => row.Id).Select(Node).ToList();
    }
}
