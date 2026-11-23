using ClosedXML.Excel;
using ProjectManagement.Contracts;
using ProjectManagement.Models;

namespace ProjectManagement.Services;

/// <summary>Xuất dự án và task thành một sheet song ngữ, dùng lại bố cục làm mẫu import.</summary>
public static class ProjectExcelExporter
{
    public const string ContentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    public static string FileName(ProjectResponse project)
    {
        var name = $"{project.ProjectCode} - {project.ProjectName}";
        name = new string(name.Select(c => char.IsControl(c) || "<>:\"/\\|?*".Contains(c) ? '_' : c).ToArray());
        return name[..Math.Min(name.Length, 180)].TrimEnd(' ', '.') + ".xlsx";
    }

    public static byte[] Create(ProjectResponse project, IReadOnlyList<ProjectTask> tasks,
        IReadOnlyDictionary<string, string> users, string language, CancellationToken cancellationToken, bool template = false)
        => ProjectExcelBilingual.Create(project, tasks, users, cancellationToken, template);

    // Giữ bộ xuất V1 để kiểm thử và đọc lại các file cũ, không phát hành làm mẫu mới.
    public static byte[] CreateLegacy(ProjectResponse project, IReadOnlyList<ProjectTask> tasks,
        IReadOnlyDictionary<string, string> users, string language, CancellationToken cancellationToken, bool template = false)
    {
        string T(string vi, string zh) => $"{vi} - {zh}";
        string People(string? codes) => string.Join(", ", (codes ?? "")
            .Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries)
            .Select(code => users.TryGetValue(code, out var name) ? $"{code} - {name}" : code));
        string Status(WorkStatus status) => status switch
        {
            WorkStatus.PENDING => T("Đang thực hiện", "进行中"),
            WorkStatus.COMPLETE => T("Đã hoàn thành", "已完成"),
            WorkStatus.HOLD => T("Đang chờ", "等待中"),
            WorkStatus.CANCEL => T("Đã hủy", "已取消"),
            _ => status.ToString()
        };
        using var workbook = new XLWorkbook();
        workbook.Style.Font.FontName = "Arial";
        workbook.Style.Font.FontSize = 11;
        workbook.Style.Alignment.Vertical = XLAlignmentVerticalValues.Top;
        var sheet = workbook.AddWorksheet("DuAn");
        sheet.ShowGridLines = true;
        var overflow = new List<(string Source, string Content)>();
        void Text(IXLCell cell, string? value)
        {
            value ??= "";
            if (value.Length <= 32767) { cell.Value = value; return; }
            // Keep long content in continuation rows on this same worksheet.
            cell.Value = T("Xem nội dung đầy đủ ở cuối trang tính", "完整内容见本工作表底部");
            for (var offset = 0; offset < value.Length; offset += 32000)
                overflow.Add((cell.Address.ToString()!, value.Substring(offset, Math.Min(32000, value.Length - offset))));
        }
        string Period(DateOnly? start, DateOnly? end) =>
            start is null && end is null ? "" : $"{start?.ToString("dd/MM/yyyy") ?? "—"} – {end?.ToString("dd/MM/yyyy") ?? "—"}";
        var widths = new[] { 8d, 40, 58, 38, 26, 18, 25, 25, 27, 27 };
        for (var column = 1; column <= widths.Length; column++) sheet.Column(column).Width = widths[column - 1];
        void Heading(int row, string title)
        {
            var range = sheet.Range(row, 1, row, 10).Merge();
            range.Value = title;
            range.Style.Fill.BackgroundColor = XLColor.FromHtml("#334155");
            range.Style.Font.FontColor = XLColor.White;
            range.Style.Font.Bold = true;
            sheet.Row(row).Height = 24;
        }
        IXLCell Field(int row, int labelColumn, int lastLabelColumn, int valueColumn, int lastValueColumn, string label)
        {
            var labelRange = sheet.Range(row, labelColumn, row, lastLabelColumn).Merge();
            labelRange.Value = label;
            labelRange.Style.Font.Bold = true;
            labelRange.Style.Fill.BackgroundColor = XLColor.FromHtml("#F1F5F9");
            return sheet.Range(row, valueColumn, row, lastValueColumn).Merge().FirstCell();
        }
        Heading(1, T("THÔNG TIN DỰ ÁN", "项目信息"));
        Text(Field(2, 1, 2, 3, 3, T("Mã dự án", "项目编号")), project.ProjectCode);
        Text(Field(2, 4, 4, 5, 5, T("Trạng thái", "状态")), Status(project.Status));
        Field(2, 6, 6, 7, 8, T("Tiến độ", "进度")).Value = project.ProgressPercent / 100m;
        sheet.Cell(2, 7).Style.NumberFormat.Format = "0.0%";
        Text(Field(3, 1, 2, 3, 8, T("Tên dự án", "项目名称")), project.ProjectName);
        Text(Field(4, 1, 2, 3, 4, T("Người phụ trách", "负责人")), People(project.Manager));
        Text(Field(4, 5, 5, 6, 8, T("Người yêu cầu", "申请人")), project.Requester);
        Text(Field(5, 1, 2, 3, 4, T("Thời gian", "时间")), Period(project.StartDate, project.EndDate));
        sheet.Range(5, 3, 5, 4).Unmerge();
        sheet.Range(5, 3, 5, 8).Merge();
        Text(Field(6, 1, 2, 3, 8, T("Mô tả", "描述")), project.Description);
        sheet.Rows(2, 5).Height = 32;
        // Size the description to its content instead of reserving a large empty block.
        var descriptionLines = (project.Description ?? "").Split('\n').Sum(line => Math.Max(1, (int)Math.Ceiling(line.Length / 150d)));
        sheet.Row(6).Height = Math.Clamp(descriptionLines * 15 + 8, 32, 180);
        sheet.Range("A2:H6").Style.Alignment.WrapText = true;
        sheet.Range("A2:H5").Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
        // Ngày thực tế ở dòng riêng; các ô cũ không đổi vị trí.
        Text(Field(7, 1, 2, 3, 4, T("Bắt đầu thực tế", "实际开始")), project.ActualStartDate?.ToString("dd/MM/yyyy"));
        Text(Field(7, 5, 5, 6, 8, T("Kết thúc thực tế", "实际结束")), project.ActualEndDate?.ToString("dd/MM/yyyy"));
        sheet.Row(7).Height = 32;
        sheet.Range("A7:H7").Style.Alignment.WrapText = true;
        Heading(8, T("DANH SÁCH CÔNG VIỆC", "任务列表"));
        var headers = new[] { T("STT", "序号"), T("Tên công việc", "任务名称"), T("Mô tả", "描述"),
            T("Người thực hiện", "执行人员"), T("Trạng thái", "状态"), T("Tiến độ", "进度"), T("Ngày bắt đầu", "开始日期"), T("Ngày kết thúc", "结束日期"),
            T("Bắt đầu thực tế", "实际开始"), T("Kết thúc thực tế", "实际结束") };
        for (var column = 1; column <= headers.Length; column++) sheet.Cell(9, column).Value = headers[column - 1];
        var heading = sheet.Range("A9:J9");
        heading.Style.Fill.BackgroundColor = XLColor.FromHtml("#334155");
        heading.Style.Font.FontColor = XLColor.White;
        heading.Style.Font.Bold = true;
        heading.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
        heading.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
        sheet.Row(9).Height = 30;
        for (var index = 0; index < tasks.Count; index++)
        {
            cancellationToken.ThrowIfCancellationRequested();
            var task = tasks[index];
            var row = index + 10;
            sheet.Cell(row, 1).Value = index + 1;
            Text(sheet.Cell(row, 2), task.TaskName);
            Text(sheet.Cell(row, 3), task.Description);
            Text(sheet.Cell(row, 4), People(task.PIC));
            sheet.Cell(row, 5).Value = Status(task.Status);
            sheet.Cell(row, 6).Value = task.Progress / 100m;
            sheet.Cell(row, 6).Style.NumberFormat.Format = "0%";
            if (task.StartDate.HasValue) sheet.Cell(row, 7).Value = task.StartDate.Value.ToDateTime(TimeOnly.MinValue);
            if (task.EndDate.HasValue) sheet.Cell(row, 8).Value = task.EndDate.Value.ToDateTime(TimeOnly.MinValue);
            if (task.ActualStartDate.HasValue) sheet.Cell(row, 9).Value = task.ActualStartDate.Value.ToDateTime(TimeOnly.MinValue);
            if (task.ActualEndDate.HasValue) sheet.Cell(row, 10).Value = task.ActualEndDate.Value.ToDateTime(TimeOnly.MinValue);
            sheet.Range(row, 7, row, 10).Style.DateFormat.Format = "dd/mm/yyyy";
            sheet.Row(row).Height = 90;
            if (index % 2 == 1) sheet.Range(row, 1, row, 10).Style.Fill.BackgroundColor = XLColor.FromHtml("#F1F5F9");
        }
        var lastTaskRow = tasks.Count + 9;
        sheet.Range(9, 1, Math.Max(10, lastTaskRow), 10).Style.Alignment.WrapText = true;
        sheet.Range(9, 1, lastTaskRow, 10).SetAutoFilter();
        var overflowRow = lastTaskRow + 3;
        if (overflow.Count > 0) Heading(overflowRow++, T("NỘI DUNG TIẾP THEO", "续文"));
        foreach (var part in overflow)
        {
            sheet.Cell(overflowRow, 1).Value = part.Source;
            sheet.Range(overflowRow, 2, overflowRow, 10).Merge().Value = part.Content;
            sheet.Range(overflowRow, 1, overflowRow, 10).Style.Alignment.WrapText = true;
            sheet.Row(overflowRow++).Height = 120;
        }
        // Keep cell boundaries visible in Excel and in printed/exported copies.
        foreach (var range in new[] { sheet.Range("A2:H7"), sheet.Range(9, 1, Math.Max(9, lastTaskRow), 10) })
        {
            range.Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
            range.Style.Border.InsideBorder = XLBorderStyleValues.Thin;
            range.Style.Border.OutsideBorderColor = XLColor.FromHtml("#CBD5E1");
            range.Style.Border.InsideBorderColor = XLColor.FromHtml("#CBD5E1");
        }
        if (template)
        {
            sheet.Cell(2, 3).CreateComment().AddText(T("Mã dự án được tạo tự động khi nhập; để trống ô này", "导入时自动生成项目编号，此处留空"));
            sheet.Cell(4, 3).CreateComment().AddText(T("Nhập mã, #mã hoặc mã - tên; nhiều người cách nhau bằng dấu phẩy. Mã chưa có sẽ giữ nguyên, không thêm nhân viên", "填写工号、#工号或工号 - 姓名，多人以逗号分隔；未知工号原样保留，不新增员工"));
            sheet.Cell(5, 3).CreateComment().AddText("dd/MM/yyyy – dd/MM/yyyy");
            sheet.Cell(6, 3).CreateComment().AddText(T("Nhập mô tả dự án", "填写项目描述"));
            sheet.Range("A10:J29").Style.Alignment.WrapText = true;
            sheet.Rows(10, 29).Height = 45;
            sheet.Range("G10:J29").Style.DateFormat.Format = "dd/mm/yyyy";
            sheet.Range("F10:F29").Style.NumberFormat.Format = "0%";
            sheet.Range("E10:E29").CreateDataValidation().List("\"Đang thực hiện - 进行中,Đã hoàn thành - 已完成,Đang chờ - 等待中,Đã hủy - 已取消\"", true);
            sheet.Range("F10:F29").CreateDataValidation().Decimal.Between(0, 1);
            sheet.Range("A10:J29").Style.Border.InsideBorder = XLBorderStyleValues.Thin;
            sheet.Range("A10:J29").Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
            sheet.Cell(10, 4).CreateComment().AddText(T("Chỉ điền mã thuộc người phụ trách dự án", "仅填写项目负责人中的工号"));
            sheet.Cell(10, 6).CreateComment().AddText(T("Nhập 0% đến 100%; hoàn thành tự đặt 100%", "填写0%到100%，完成状态自动设为100%"));
        }
        sheet.PageSetup.PageOrientation = XLPageOrientation.Landscape;
        sheet.PageSetup.FitToPages(1, 0);
        cancellationToken.ThrowIfCancellationRequested();
        using var output = new MemoryStream();
        workbook.SaveAs(output);
        return output.ToArray();
    }
}
