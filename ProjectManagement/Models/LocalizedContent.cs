using ProjectManagement.Contracts;

namespace ProjectManagement.Models;

/// <summary>Chỉ lưu hai bản VI/ZH. Giá trị API cũ được tiếp nhận vào bản VI, không có cột lưu thứ ba.</summary>
public static class LocalizedContent
{
    public static string? First(params string?[] values) => values.FirstOrDefault(value => !string.IsNullOrWhiteSpace(value))?.Trim();

    public static void Apply(Project item, ProjectWriteRequest request)
    {
        if (request.HasLocalizedName)
        {
            item.ProjectNameVi = First(request.ProjectNameVi);
            item.ProjectNameZh = First(request.ProjectNameZh);
        }
        else item.ProjectNameVi = First(request.ProjectName);
        if (request.HasLocalizedDescription)
        {
            item.DescriptionVi = First(request.DescriptionVi);
            item.DescriptionZh = First(request.DescriptionZh);
        }
        else item.DescriptionVi = First(request.Description);
    }

    public static void Apply(ProjectTask item, TaskWriteRequest request)
    {
        if (request.HasLocalizedName)
        {
            item.TaskNameVi = First(request.TaskNameVi);
            item.TaskNameZh = First(request.TaskNameZh);
        }
        else item.TaskNameVi = First(request.TaskName);
        if (request.HasLocalizedDescription)
        {
            item.DescriptionVi = First(request.DescriptionVi);
            item.DescriptionZh = First(request.DescriptionZh);
        }
        else item.DescriptionVi = First(request.Description);
    }
}
