using ClosedXML.Excel;
using ProjectManagement.Contracts;
using ProjectManagement.Models;

namespace ProjectManagement.Services;

/// <summary>Mẫu V2: mỗi task có hai dòng VI/ZH, các thông tin dùng chung gộp dọc.</summary>
public static class ProjectExcelBilingual
{
    public const string Marker = "IT_PROJECT_BILINGUAL_V2";
    public static byte[] Create(ProjectResponse project, IReadOnlyList<ProjectTask> tasks,
        IReadOnlyDictionary<string, string> users, CancellationToken token, bool template)
    {
        using var book = new XLWorkbook();
        var sheet = book.AddWorksheet("DuAn");
        sheet.Style.Font.FontName = "Arial";
        sheet.Style.Font.FontSize = 11;
        sheet.Style.Alignment.Vertical = XLAlignmentVerticalValues.Top;
        sheet.Style.Alignment.WrapText = true;
        sheet.ShowGridLines = true;
        sheet.Cell("L1").Value = Marker;
        sheet.Column(12).Hide();
        var widths = new[] { 6d, 10, 42, 62, 35, 24, 14, 18, 18, 18, 18 };
        for (var col = 1; col <= 11; col++) sheet.Column(col).Width = widths[col - 1];
        var overflow = new List<(string Address, string Text)>();
        void Text(IXLCell cell, string? text)
        {
            text ??= "";
            if (text.Length <= 32767) { cell.Value = text; return; }
            cell.Value = "Nội dung tiếp theo ở cuối sheet / 续文见工作表底部";
            for (var offset = 0; offset < text.Length; offset += 32000)
                overflow.Add((cell.Address.ToString()!, text.Substring(offset, Math.Min(32000, text.Length - offset))));
        }
        void Heading(int row, string title)
        {
            var r = sheet.Range(row, 1, row, 11).Merge();
            r.Value = title;
            r.Style.Fill.BackgroundColor = XLColor.FromHtml("#334155");
            r.Style.Font.FontColor = XLColor.White;
            r.Style.Font.Bold = true;
            sheet.Row(row).Height = 26;
        }
        IXLCell Field(int row, int l1, int l2, int v1, int v2, string label)
        {
            var l = sheet.Range(row, l1, row, l2).Merge();
            l.Value = label;
            l.Style.Font.Bold = true;
            l.Style.Fill.BackgroundColor = XLColor.FromHtml("#F1F5F9");
            return sheet.Range(row, v1, row, v2).Merge().FirstCell();
        }
        string People(string? value) => string.Join(", ", (value ?? "").Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries)
            .Select(code => users.TryGetValue(code, out var name) ? $"{code} - {name}" : code));
        string Status(WorkStatus status) => status switch
        {
            WorkStatus.PENDING => "Đang thực hiện - 进行中", WorkStatus.COMPLETE => "Đã hoàn thành - 已完成",
            WorkStatus.HOLD => "Đang chờ - 等待中", _ => "Đã hủy - 已取消"
        };
        string Period(DateOnly? from, DateOnly? to) => from is null && to is null ? "" : $"{from?.ToString("dd/MM/yyyy") ?? "—"} – {to?.ToString("dd/MM/yyyy") ?? "—"}";
        // Trường cũ chỉ chuyển sang ô VI khi chưa có cả hai bản dịch, không tự chia nội dung.
        string? Vi(string? vi, string? zh, string? legacy) => LocalizedContent.First(vi) ?? (LocalizedContent.First(zh) is null ? legacy : null);
        Heading(1, "THÔNG TIN DỰ ÁN - 项目信息");
        Text(Field(2,1,2,3,4,"Mã dự án - 项目编号"), project.ProjectCode);
        Text(Field(2,5,5,6,7,"Trạng thái - 状态"), Status(project.Status));
        // Giữ nguyên vị trí các ô import; phần trạng thái dùng hết khoảng trống còn lại.
        sheet.Range(2,6,2,7).Unmerge();
        sheet.Range(2,6,2,11).Merge();
        Text(Field(3,1,2,3,11,"Tên dự án (VI) - 越文名称"), Vi(project.ProjectNameVi, project.ProjectNameZh, project.ProjectName));
        Text(Field(4,1,2,3,11,"Tên dự án (ZH) - 中文名称"), project.ProjectNameZh);
        Text(Field(5,1,2,3,5,"Phụ trách - 负责人"), People(project.Manager));
        Text(Field(5,6,6,7,11,"Yêu cầu - 申请人"), project.Requester);
        Text(Field(6,1,2,3,5,"Ngày dự kiến - 计划日期"), Period(project.StartDate, project.EndDate));
        Text(Field(6,6,6,7,11,"Ngày thực tế - 实际日期"), Period(project.ActualStartDate, project.ActualEndDate));
        Text(Field(7,1,2,3,11,"Mô tả (VI) - 越文描述"), Vi(project.DescriptionVi, project.DescriptionZh, project.Description));
        Text(Field(8,1,2,3,11,"Mô tả (ZH) - 中文描述"), project.DescriptionZh);
        Text(Field(9,1,2,3,11,"Phòng ban - 申请部门"), project.RequesterDepartmentName);
        sheet.Rows(2,6).Height = 32;
        sheet.Row(9).Height = 30;
        foreach (var (row,value) in new[] { (7, Vi(project.DescriptionVi, project.DescriptionZh, project.Description)), (8, project.DescriptionZh) })
            sheet.Row(row).Height = Math.Clamp(((value ?? "").Split('\n').Sum(line => Math.Max(1, (int)Math.Ceiling(line.Length / 150d)))) * 16 + 8, 38, 180);
        Heading(10, "DANH SÁCH CÔNG VIỆC - 任务列表");
        var headers = new[] { "STT - 序号", "Ngôn ngữ - 语言", "Tên công việc - 任务名称", "Mô tả - 描述", "Người thực hiện - 执行人员", "Trạng thái - 状态", "Tiến độ - 进度", "Ngày bắt đầu - 开始日期", "Ngày kết thúc - 结束日期", "Bắt đầu thực tế - 实际开始", "Kết thúc thực tế - 实际结束" };
        for (var col = 1; col <= 11; col++) sheet.Cell(11,col).Value = headers[col-1];
        var header=sheet.Range("A11:K11");
        header.Style.Font.Bold=true; header.Style.Font.FontColor=XLColor.White;
        header.Style.Fill.BackgroundColor=XLColor.FromHtml("#334155");
        header.Style.Alignment.Vertical=XLAlignmentVerticalValues.Center;
        sheet.Row(11).Height=45;
        var pairs=template ? 10 : tasks.Count;
        for (var index=0;index<pairs;index++)
        {
            token.ThrowIfCancellationRequested();
            var row=12+index*2;
            var task=template ? null : tasks[index];
            foreach(var col in new[] {1,5,6,7,8,9,10,11})
                sheet.Range(row,col,row+1,col).Merge().Style.Alignment.Vertical=XLAlignmentVerticalValues.Center;
            sheet.Cell(row,1).Value=index+1;
            sheet.Cell(row,2).Value="VI";
            sheet.Cell(row+1,2).Value="中文";
            if(task is not null)
            {
                Text(sheet.Cell(row,3),Vi(task.TaskNameVi,task.TaskNameZh,task.TaskName));
                Text(sheet.Cell(row+1,3),task.TaskNameZh);
                Text(sheet.Cell(row,4),Vi(task.DescriptionVi,task.DescriptionZh,task.Description));
                Text(sheet.Cell(row+1,4),task.DescriptionZh);
                Text(sheet.Cell(row,5),People(task.PIC));
                sheet.Cell(row,6).Value=Status(task.Status);
                sheet.Cell(row,7).Value=task.Progress/100m;
                foreach(var (col,date) in new[] {(8,task.StartDate),(9,task.EndDate),(10,task.ActualStartDate),(11,task.ActualEndDate)})
                    if(date.HasValue) sheet.Cell(row,col).Value=date.Value.ToDateTime(TimeOnly.MinValue);
            }
            sheet.Range(row,7,row+1,7).Style.NumberFormat.Format="0%";
            sheet.Range(row,8,row+1,11).Style.DateFormat.Format="dd/mm/yyyy";
            sheet.Rows(row,row+1).Height=template ? 45 : 72;
            if(index%2==1) sheet.Range(row,1,row+1,11).Style.Fill.BackgroundColor=XLColor.FromHtml("#F1F5F9");
            if(template)
            {
                sheet.Cell(row,6).CreateDataValidation().List("\"Đang thực hiện - 进行中,Đã hoàn thành - 已完成,Đang chờ - 等待中,Đã hủy - 已取消\"",true);
                sheet.Cell(row,7).CreateDataValidation().Decimal.Between(0,1);
            }
        }
        var last=11+pairs*2;
        var used=sheet.Range(2,1,Math.Max(11,last),11);
        used.Style.Border.InsideBorder=XLBorderStyleValues.Thin;
        used.Style.Border.OutsideBorder=XLBorderStyleValues.Thin;
        used.Style.Border.InsideBorderColor=XLColor.FromHtml("#CBD5E1");
        used.Style.Border.OutsideBorderColor=XLColor.FromHtml("#CBD5E1");
        var extra=last+3;
        if(overflow.Count>0) Heading(extra++,"NỘI DUNG TIẾP THEO - 续文");
        foreach(var part in overflow)
        {
            sheet.Cell(extra,1).Value=part.Address;
            sheet.Range(extra,2,extra,11).Merge().Value=part.Text;
            sheet.Row(extra++).Height=120;
        }
        if(template)
        {
            sheet.Cell("C3").CreateComment().AddText("Tên ít nhất một ngôn ngữ. Giữ cặp dòng VI/中文 của mỗi công việc. / 至少填写一种语言名称，保留每项任务的VI/中文行对。");
            sheet.Cell("E12").CreateComment().AddText("Mã, #mã hoặc mã - tên; nhiều người cách nhau bằng dấu phẩy. / 工号、#工号或工号 - 姓名，多人用逗号分隔。");
            sheet.Cell("G12").CreateComment().AddText("0%–100%. Hoàn thành tự đặt 100%. / 已完成自动设为100%。");
        }
        sheet.PageSetup.PageOrientation=XLPageOrientation.Landscape;
        sheet.PageSetup.FitToPages(1,0);
        using var output=new MemoryStream(); book.SaveAs(output); return output.ToArray();
    }

    public static ProjectExcelDraft Read(XLWorkbook book, IReadOnlyDictionary<string,string> users, CancellationToken token)
    {
        var source=book.Worksheet("DuAn");
        var issues=new List<ExcelImportIssue>();
        var last=source.LastRowUsed(XLCellsUsedOptions.Contents)?.RowNumber() ?? 11;
        if(last>12000) return new(new(),[],[new(1,"Tệp vượt quá 12000 dòng. / 文件超过12000行。")],[]);
        var continuations=new Dictionary<string,string>();
        var end=last;
        for(var row=12;row<=last;row++)
        {
            if(source.Cell(row,1).GetString()!="NỘI DUNG TIẾP THEO - 续文") continue;
            end=row-3;
            for(var part=row+1;part<=last;part++)
            {
                var address=source.Cell(part,1).GetString();
                if(!System.Text.RegularExpressions.Regex.IsMatch(address,"^[A-K][0-9]+$")) continue;
                if(source.Cell(part,2).HasFormula) issues.Add(new(part,"Không dùng công thức. / 不允许公式。"));
                continuations[address]=continuations.GetValueOrDefault(address,"")+source.Cell(part,2).GetString();
                if(continuations[address].Length>1_000_000) throw new InvalidDataException("Cell content too large");
            }
            break;
        }
        string ReadText(int row,int col)
        {
            var cell=source.Cell(row,col);
            if(cell.HasFormula) issues.Add(new(row,"Không dùng công thức trong vùng dữ liệu. / 数据区域不允许公式。"));
            return continuations.GetValueOrDefault(cell.Address.ToString()!,cell.GetString()).Trim();
        }
        _ = ReadText(9,3); // Phòng ban cũng không được chứa công thức.
        if(source.Cell(11,3).GetString()!="Tên công việc - 任务名称" || source.Cell(11,8).GetString()!="Ngày bắt đầu - 开始日期")
            return new(new(),[],[new(11,"Tệp không đúng mẫu. Hãy tải mẫu dự án mới. / 文件格式不正确，请下载最新模板。")],[]);
        // Tái dùng bộ kiểm tra V1 cho trạng thái, ngày, mã nhân viên và tiến độ.
        using var legacy=new XLWorkbook(); var target=legacy.AddWorksheet("DuAn");
        var legacyOverflow=new List<(string Address,string Content)>();
        void Put(int row,int col,string? value)
        {
            value??="";
            var cell=target.Cell(row,col);
            if(value.Length<=32767) {cell.Value=value;return;}
            cell.Value="Xem nội dung tiếp theo";
            for(var offset=0;offset<value.Length;offset+=32000)
                legacyOverflow.Add((cell.Address.ToString()!,value.Substring(offset,Math.Min(32000,value.Length-offset))));
        }
        target.Cell(3,1).Value="Tên dự án - 项目名称";
        target.Cell(9,2).Value="Tên công việc - 任务名称";
        target.Cell(9,7).Value="Ngày bắt đầu - 开始日期";
        target.Cell(9,8).Value="Ngày kết thúc - 结束日期";
        target.Cell(9,9).Value="Bắt đầu thực tế - 实际开始";
        target.Cell(9,10).Value="Kết thúc thực tế - 实际结束";
        var nv=ReadText(3,3); var nz=ReadText(4,3); var dv=ReadText(7,3); var dz=ReadText(8,3);
        target.Cell(3,3).Value=LocalizedContent.First(nv,nz) ?? "";
        Put(6,3,LocalizedContent.First(dv,dz));
        target.Cell(4,3).Value=ReadText(5,3); target.Cell(4,6).Value=ReadText(5,7);
        target.Cell(5,3).Value=ReadText(6,3); target.Cell(2,5).Value=ReadText(2,6);
        var actualPeriod=System.Text.RegularExpressions.Regex.Split(ReadText(6,7),@"\s+[–—]\s+|\s+-\s+");
        if(actualPeriod.Length>2) issues.Add(new(6,"Khoảng ngày thực tế không hợp lệ. / 实际日期范围无效。"));
        target.Cell(7,1).Value="Bắt đầu thực tế - 实际开始";
        target.Cell(7,3).Value=actualPeriod[0]; target.Cell(7,6).Value=actualPeriod.Length>1?actualPeriod[1]:"";
        var translations=new List<(int Row,string Vi,string Zh,string Dv,string Dz)>();
        for(var row=12;row<=end;row+=2)
        {
            token.ThrowIfCancellationRequested();
            // Bỏ dòng mẫu trống, nhưng không bỏ dòng có metadata mà thiếu tên.
            if(source.Range(row,3,row+1,11).Cells().All(c=>c.IsEmpty())) continue;
            if(ReadText(row,2)!="VI" || ReadText(row+1,2)!="中文") issues.Add(new(row,"Mỗi công việc cần đúng cặp dòng VI/中文. / 每项任务必须有VI/中文行对。"));
            var vi=ReadText(row,3);var zh=ReadText(row+1,3);var descVi=ReadText(row,4);var descZh=ReadText(row+1,4);
            translations.Add((row,vi,zh,descVi,descZh)); var dest=9+translations.Count;
            target.Cell(dest,2).Value=LocalizedContent.First(vi,zh)??"";
            Put(dest,3,LocalizedContent.First(descVi,descZh));
            foreach(var (from,to) in new[]{(5,4),(6,5),(7,6),(8,7),(9,8),(10,9),(11,10)})
            {
                _=ReadText(row,from);
                target.Cell(dest,to).Value=source.Cell(row,from).Value;
                target.Cell(dest,to).Style.NumberFormat.Format=source.Cell(row,from).Style.NumberFormat.Format;
                if(!source.Cell(row+1,from).IsEmpty()) issues.Add(new(row+1,"Thông tin dùng chung chỉ nhập ở dòng VI, giữ ô gộp. / 共用资料只填写在VI行，请保留合并单元格。"));
            }
        }
        var overflowRow=12+translations.Count;
        if(legacyOverflow.Count>0) target.Cell(overflowRow++,1).Value="NỘI DUNG TIẾP THEO - 续文";
        foreach(var part in legacyOverflow) {target.Cell(overflowRow,1).Value=part.Address;target.Cell(overflowRow++,2).Value=part.Content;}
        var draft=ProjectExcelImporter.ReadLegacy(legacy,users,token);
        draft.Project.ProjectNameVi=LocalizedContent.First(nv);draft.Project.ProjectNameZh=LocalizedContent.First(nz);
        draft.Project.DescriptionVi=LocalizedContent.First(dv);draft.Project.DescriptionZh=LocalizedContent.First(dz);
        for(var i=0;i<draft.Tasks.Count;i++)
        {
            var tr=translations[i];var task=draft.Tasks[i];
            task.TaskNameVi=LocalizedContent.First(tr.Vi);task.TaskNameZh=LocalizedContent.First(tr.Zh);
            task.DescriptionVi=LocalizedContent.First(tr.Dv);task.DescriptionZh=LocalizedContent.First(tr.Dz);
            if(tr.Vi.Length>255 || tr.Zh.Length>255) issues.Add(new(tr.Row,"Tên tối đa 255 ký tự. / 名称最多255个字符。"));
        }
        if(nv.Length>255 || nz.Length>255) issues.Add(new(3,"Tên tối đa 255 ký tự. / 名称最多255个字符。"));
        foreach(var issue in draft.Errors)
            issues.Add(issue with {Row=issue.Row>=10&&issue.Row-10<translations.Count?translations[issue.Row-10].Row:issue.Row switch{4=>5,5=>6,6=>7,7=>6,_=>issue.Row}});
        return draft with {Errors=issues.Distinct().ToList(),TaskRows=translations.Select(t=>t.Row).ToList()};
    }
}
