using System.ComponentModel.DataAnnotations;
using System.Globalization;
using System.Text.RegularExpressions;
using ClosedXML.Excel;
using ProjectManagement.Contracts;
using ProjectManagement.Models;

namespace ProjectManagement.Services;

public sealed record ExcelImportIssue(int Row, string Message);
public sealed record ProjectExcelDraft(ProjectWriteRequest Project, IReadOnlyList<TaskWriteRequest> Tasks,
    IReadOnlyList<ExcelImportIssue> Errors, IReadOnlyList<string> UnknownCodes)
{
    public IReadOnlyList<int> TaskRows { get; init; } = [];
}

/// <summary>Đọc mẫu DuAn cố định, giữ mã nhân viên chưa có trong danh mục và báo lỗi theo dòng.</summary>
public static class ProjectExcelImporter
{
    public static ProjectExcelDraft Read(XLWorkbook workbook, IReadOnlyDictionary<string, string> users, CancellationToken token)
        => workbook.TryGetWorksheet("DuAn", out var sheet) && sheet.Cell("L1").GetString() == ProjectExcelBilingual.Marker
            ? ProjectExcelBilingual.Read(workbook, users, token) : ReadLegacy(workbook, users, token);

    internal static ProjectExcelDraft ReadLegacy(XLWorkbook workbook, IReadOnlyDictionary<string, string> users, CancellationToken token)
    {
        var errors = new List<ExcelImportIssue>();
        var tasks = new List<TaskWriteRequest>();
        var taskRows = new List<int>();
        var project = new ProjectWriteRequest();
        var unknown = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        if (!workbook.TryGetWorksheet("DuAn", out var sheet) ||
            sheet.Cell(3, 1).GetString() != "Tên dự án - 项目名称" ||
            sheet.Cell(9, 2).GetString() != "Tên công việc - 任务名称" ||
            sheet.Cell(9, 7).GetString() != "Ngày bắt đầu - 开始日期" ||
            sheet.Cell(9, 8).GetString() != "Ngày kết thúc - 结束日期")
            return new(project, tasks, [new(1, "Tệp không đúng mẫu. Hãy tải mẫu dự án mới. / 文件格式不正确，请下载最新模板。")], []);
        var last = sheet.LastRowUsed(XLCellsUsedOptions.Contents)?.RowNumber() ?? 9;
        if (last > 6000) return new(project, tasks, [new(1, "Tệp vượt quá 6000 dòng. / 文件超过6000行。")], []);
        var continuations = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var contentEnd = last;
        for (var row = 10; row <= last; row++)
        {
            if (sheet.Cell(row, 1).GetString() != "NỘI DUNG TIẾP THEO - 续文") continue;
            contentEnd = row - 1;
            for (var part = row + 1; part <= last; part++)
            {
                var address = sheet.Cell(part, 1).GetString();
                if (!Regex.IsMatch(address, "^[A-H][0-9]+$")) continue;
                continuations[address] = continuations.GetValueOrDefault(address, "") + sheet.Cell(part, 2).GetString();
                if (continuations[address].Length > 1_000_000) throw new InvalidDataException("Cell content too large");
            }
            break;
        }
        string Text(int row, int col)
        {
            var cell = sheet.Cell(row, col);
            if (cell.HasFormula) errors.Add(new(row, "Không dùng công thức trong vùng dữ liệu. / 数据区域不允许公式。"));
            return continuations.GetValueOrDefault(cell.Address.ToString()!, cell.GetString()).Trim();
        }
        string? People(int row, int col)
        {
            var codes = new List<string>();
            foreach (var item in Regex.Split(Text(row, col), @"[,;，；\r\n]+"))
            {
                var code = Regex.Split(item.Trim(), @"\s+[-–—]\s+", RegexOptions.None)[0].Trim();
                // Excel sources may prefix an employee code with #; persist only the code.
                if (code.StartsWith('#')) code = code[1..].Trim();
                if (code.Length == 0) continue;
                if (code.Length > 50 || code.Any(char.IsWhiteSpace))
                { errors.Add(new(row, "Mã nhân viên không hợp lệ. / 员工工号无效。")); continue; }
                var canonical = users.Keys.FirstOrDefault(key => key.Equals(code, StringComparison.OrdinalIgnoreCase));
                if (canonical is null) unknown.Add(code);
                codes.Add(canonical ?? code);
            }
            return codes.Count == 0 ? null : string.Join(',', codes.Distinct(StringComparer.OrdinalIgnoreCase));
        }
        WorkStatus Status(int row, int col)
        {
            var value = Text(row, col);
            if (value.Length == 0) return WorkStatus.PENDING;
            var vi = value.Split(" - ")[0].Trim();
            if (Enum.TryParse<WorkStatus>(value, true, out var result) && Enum.IsDefined(result)) return result;
            return vi switch
            {
                "Đang thực hiện" or "进行中" => WorkStatus.PENDING,
                "Đã hoàn thành" or "已完成" => WorkStatus.COMPLETE,
                "Đang chờ" or "等待中" => WorkStatus.HOLD,
                "Đã hủy" or "已取消" => WorkStatus.CANCEL,
                _ => BadStatus()
            };
            WorkStatus BadStatus() { errors.Add(new(row, "Trạng thái không hợp lệ. / 状态无效。")); return WorkStatus.PENDING; }
        }
        DateOnly? DateText(string value, int row)
        {
            if (string.IsNullOrWhiteSpace(value) || value == "—") return null;
            if (DateOnly.TryParseExact(value.Trim(), ["dd/MM/yyyy", "d/M/yyyy", "yyyy-MM-dd"], CultureInfo.InvariantCulture, DateTimeStyles.None, out var date)) return date;
            errors.Add(new(row, "Ngày phải có dạng dd/MM/yyyy hoặc yyyy-MM-dd. / 日期格式应为 dd/MM/yyyy 或 yyyy-MM-dd。"));
            return null;
        }
        DateOnly? Date(int row, int col)
        {
            var text = Text(row, col);
            var cell = sheet.Cell(row, col);
            if (cell.DataType == XLDataType.DateTime) return DateOnly.FromDateTime(cell.GetDateTime());
            if (cell.DataType == XLDataType.Number && cell.TryGetValue<DateTime>(out var date)) return DateOnly.FromDateTime(date);
            return DateText(text, row);
        }
        void Validate(object value, int row)
        {
            var results = new List<ValidationResult>();
            Validator.TryValidateObject(value, new ValidationContext(value), results, true);
            foreach (var result in results) errors.Add(new(row, result.ErrorMessage ?? "Dữ liệu không hợp lệ. / 数据无效。"));
        }
        project.ProjectName = Text(3, 3);
        project.Manager = People(4, 3);
        project.Requester = Text(4, 6);
        project.Description = Text(6, 3);
        project.Status = Status(2, 5);
        var period = Regex.Split(Text(5, 3), @"\s+[–—]\s+|\s+-\s+");
        if (period.Length > 2) errors.Add(new(5, "Khoảng ngày không hợp lệ. / 日期范围无效。"));
        project.StartDate = DateText(period[0], 5);
        project.EndDate = period.Length > 1 ? DateText(period[1], 5) : null;
        if (sheet.Cell(7, 1).GetString() == "Bắt đầu thực tế - 实际开始")
        {
            project.ActualStartDate = Date(7, 3);
            project.ActualEndDate = Date(7, 6);
        }
        var hasActualDates = sheet.Cell(9, 9).GetString() == "Bắt đầu thực tế - 实际开始" &&
            sheet.Cell(9, 10).GetString() == "Kết thúc thực tế - 实际结束";
        Validate(project, 3);
        var managers = (project.Manager ?? "").Split(',').ToHashSet(StringComparer.OrdinalIgnoreCase);
        for (var row = 10; row <= contentEnd; row++)
        {
            token.ThrowIfCancellationRequested();
            if (sheet.Range(row, 2, row, hasActualDates ? 10 : 8).Cells().All(cell => cell.IsEmpty())) continue;
            var task = new TaskWriteRequest {
                ProjectCode = "AUTO", TaskName = Text(row, 2), Description = Text(row, 3), PIC = People(row, 4),
                Status = Status(row, 5), StartDate = Date(row, 7), EndDate = Date(row, 8),
                ActualStartDate = hasActualDates ? Date(row, 9) : null, ActualEndDate = hasActualDates ? Date(row, 10) : null
            };
            var progressCell = sheet.Cell(row, 6);
            var progressText = Text(row, 6);
            decimal progress = 0;
            if (progressText.Length != 0)
            {
                if (progressCell.DataType == XLDataType.Number && progressCell.TryGetValue<decimal>(out var number))
                    progress = progressCell.Style.NumberFormat.Format.Contains('%') || progressCell.Style.NumberFormat.NumberFormatId is 9 or 10 ? number * 100 : number;
                else if (!decimal.TryParse(progressText.TrimEnd('%').Trim(), NumberStyles.Number, CultureInfo.InvariantCulture, out progress))
                    errors.Add(new(row, "Tiến độ phải từ 0 đến 100%. / 进度必须为0到100%。"));
                progress = Math.Round(progress, 8);
            }
            if (progress < 0 || progress > 100 || progress != decimal.Truncate(progress))
                errors.Add(new(row, "Tiến độ phải là số nguyên từ 0 đến 100%. / 进度必须为0到100的整数。"));
            task.Progress = task.Status == WorkStatus.COMPLETE ? 100 : (int)Math.Clamp(progress, 0, 100);
            Validate(task, row);
            if ((task.PIC ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries).Any(code => !managers.Contains(code)))
                errors.Add(new(row, "Người thực hiện phải thuộc danh sách người phụ trách dự án. / 执行人员必须在项目负责人名单中。"));
            tasks.Add(task);
            taskRows.Add(row);
        }
        if (tasks.Count > 5000) errors.Add(new(10, "Tối đa 5000 công việc. / 最多5000项任务。"));
        return new(project, tasks, errors.Distinct().ToList(), unknown.Order().ToList()) { TaskRows = taskRows };
    }
}
