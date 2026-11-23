using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using ClosedXML.Excel;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using ProjectManagement.Data;
using ProjectManagement.Models;
using ProjectManagement.Services;

namespace ProjectManagement.ApiTests;

internal static class BilingualVerification
{
    public static async Task<int> Run(HttpClient client,IServiceProvider services)
    {
        var count=0;
        void Check(bool ok,string label) {if(!ok)throw new Exception("Bilingual: "+label);count++;}
        async Task<JsonElement> Request(HttpMethod method,string url,object? body,HttpStatusCode status)
        {
            using var request=new HttpRequestMessage(method,url);if(body is not null)request.Content=JsonContent.Create(body);
            using var response=await client.SendAsync(request);var text=await response.Content.ReadAsStringAsync();
            Check(response.StatusCode==status,url+" "+text);return string.IsNullOrWhiteSpace(text) ? default : JsonDocument.Parse(text).RootElement.Clone();
        }
        var project=await Request(HttpMethod.Post,"/api/projects",new {projectNameVi="Dự án riêng",projectNameZh="独立项目",descriptionVi="Mô tả",descriptionZh="说明",manager="01959"},HttpStatusCode.Created);
        var id=project.GetProperty("id").GetInt32();var code=project.GetProperty("projectCode").GetString();
        Check(project.GetProperty("projectNameVi").GetString()=="Dự án riêng"&&project.GetProperty("projectNameZh").GetString()=="独立项目","separate names returned");
        var chinese=await Request(HttpMethod.Post,"/api/tasks",new {projectCode=code,taskNameZh="中文任务",descriptionZh="备注",pic="01959",progress=20},HttpStatusCode.Created);
        Check(chinese.GetProperty("taskName").GetString()=="中文任务"&&chinese.GetProperty("taskNameVi").ValueKind==JsonValueKind.Null,"Chinese-only name valid with compatibility fallback");
        var search=await Request(HttpMethod.Get,"/api/projects?search=独立项目",null,HttpStatusCode.OK);
        Check(search.GetProperty("items").EnumerateArray().Any(p=>p.GetProperty("id").GetInt32()==id),"search finds Chinese translation");
        var edited=await Request(HttpMethod.Put,$"/api/projects/{id}",new {projectNameVi="Đã sửa",projectNameZh="修改项目",descriptionVi=(string?)null,descriptionZh=(string?)null,manager="01959"},HttpStatusCode.OK);
        Check(edited.GetProperty("description").ValueKind==JsonValueKind.Null&&edited.GetProperty("descriptionZh").ValueKind==JsonValueKind.Null,"both descriptions clear explicitly");
        await Request(HttpMethod.Post,"/api/projects",new {projectNameVi=" ",projectNameZh=""},HttpStatusCode.BadRequest);
        await Request(HttpMethod.Post,"/api/tasks",new {projectCode=code,taskNameZh=new string('中',256)},HttpStatusCode.BadRequest);
        // The relational model must never reintroduce a third stored content variant.
        using (var scope = services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            foreach (var type in new[] { typeof(Project), typeof(ProjectTask) })
            {
                var entity = db.Model.FindEntityType(type)!;
                Check(entity.FindProperty(type == typeof(Project) ? "ProjectName" : "TaskName") is null
                    && entity.FindProperty("Description") is null, "legacy accessors are not database columns");
            }
        }
        var byChineseName = await Request(HttpMethod.Get, "/api/projects?projectName=" + Uri.EscapeDataString("修改项目") + "&sortBy=projectName", null, HttpStatusCode.OK);
        Check(byChineseName.GetProperty("items").EnumerateArray().Any(p => p.GetProperty("id").GetInt32() == id), "name filter and sorting use persisted translations");
        var byChineseDescription = await Request(HttpMethod.Get, "/api/tasks?description=" + Uri.EscapeDataString("备注") + "&sortBy=taskName", null, HttpStatusCode.OK);
        Check(byChineseDescription.GetProperty("items").EnumerateArray().Any(t => t.GetProperty("id").GetInt32() == chinese.GetProperty("id").GetInt32()), "description filter and Chinese-only sorting work without legacy columns");
        var template=await client.GetByteArrayAsync("/api/projects/template");using var book=new XLWorkbook(new MemoryStream(template));var sheet=book.Worksheet("DuAn");
        Check(sheet.Cell("L1").GetString()==ProjectExcelBilingual.Marker,"endpoint returns V2 template");
        Check(sheet.MergedRanges.Any(r=>r.RangeAddress.ToString()=="A12:A13")&&sheet.MergedRanges.Any(r=>r.RangeAddress.ToString()=="E12:E13"),"common fields vertically merged");
        Check(sheet.Cell(12,2).GetString()=="VI"&&sheet.Cell(13,2).GetString()=="中文","explicit language pair");
        sheet.Cell(3,3).Value="Dự án từ mẫu";sheet.Cell(4,3).Value="模板项目";
        sheet.Cell(5,3).Value="#01959 - Tên tham khảo";
        sheet.Cell(7,3).Value="Mô tả Việt";sheet.Cell(8,3).Value="中文说明";
        sheet.Cell(12,3).Value="Việc Việt";sheet.Cell(13,3).Value="中文任务一";
        sheet.Cell(12,4).Value="Nội dung Việt";sheet.Cell(13,4).Value="内容一";
        sheet.Cell(12,5).Value="01959";sheet.Cell(12,6).Value="PENDING";sheet.Cell(12,7).Value=.35;
        sheet.Cell(12,8).Value=new DateTime(2026,11,1);sheet.Cell(12,9).Value=new DateTime(2026,11,20);
        sheet.Cell(15,3).Value="只有中文任务";sheet.Cell(14,5).Value="01959";sheet.Cell(14,6).Value="COMPLETE";
        var uploadStreams=new List<MemoryStream>();
        async Task<JsonElement> Send(string url,HttpStatusCode expected)
        {
            var uploadStream=new MemoryStream(); uploadStreams.Add(uploadStream);book.SaveAs(uploadStream);using var form=new MultipartFormDataContent();form.Add(new ByteArrayContent(uploadStream.ToArray()),"file","paired.xlsx");
            using var response=await client.PostAsync(url,form);var text=await response.Content.ReadAsStringAsync();Check(response.StatusCode==expected,url+" "+text);return string.IsNullOrWhiteSpace(text) ? default : JsonDocument.Parse(text).RootElement.Clone();
        }
        var preview=await Send("/api/projects/import/preview",HttpStatusCode.OK);
        Check(preview.GetProperty("errors").GetArrayLength()==0,"valid paired template has no errors: "+preview);
        Check(preview.GetProperty("tasks").GetArrayLength()==2,"two pairs become two tasks, not four");
        Check(preview.GetProperty("tasks")[0].GetProperty("taskNameZh").GetString()=="中文任务一","Chinese task name retained in preview");
        Check(preview.GetProperty("tasks")[1].GetProperty("progress").GetInt32()==100,"complete pair normalized to 100 percent");
        var imported=await Send("/api/projects/import",HttpStatusCode.Created);var importedId=imported.GetProperty("id").GetInt32();
        Check(imported.GetProperty("totalTasks").GetInt32()==2&&imported.GetProperty("projectNameZh").GetString()=="模板项目","commit keeps both languages");
        sheet.Cell(13,2).Value="VI";var bad=await Send("/api/projects/import/preview",HttpStatusCode.OK);
        Check(bad.GetProperty("errors").GetArrayLength()>0,"broken language pair reports error");
        await Send("/api/projects/import",HttpStatusCode.BadRequest);sheet.Cell(13,2).Value="中文";
        sheet.Cell(13,4).FormulaA1="1+1";bad=await Send("/api/projects/import/preview",HttpStatusCode.OK);
        Check(bad.GetProperty("errors").GetArrayLength()>0,"Chinese description formulas are rejected");
        using(var scope=services.CreateScope())
        {
            var db=scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();var row=await db.Projects.Include(p=>p.Tasks).SingleAsync(p=>p.Id==importedId);
            row.DescriptionVi=new string('V',35000);row.DescriptionZh=new string('中',36000);row.Description=row.DescriptionVi;
            row.Tasks.First().DescriptionZh=new string('文',34000);await db.SaveChangesAsync();
        }
        using(var export=new XLWorkbook(new MemoryStream(await client.GetByteArrayAsync($"/api/projects/{importedId}/export"))))
        {
            var draft=ProjectExcelImporter.Read(export,new Dictionary<string,string>{{"01959","Đàm Đức Hải"}},default);
            Check(draft.Errors.Count==0,"new export roundtrips: "+string.Join(';',draft.Errors));
            Check(draft.Project.DescriptionVi?.Length==35000&&draft.Project.DescriptionZh?.Length==36000,"long project translations preserved separately");
            Check(draft.Tasks.Any(t=>t.DescriptionZh?.Length==34000),"long Chinese task description preserved");
        }
        await Request(HttpMethod.Delete,$"/api/projects/{id}",null,HttpStatusCode.NoContent);
        await Request(HttpMethod.Delete,$"/api/projects/{importedId}",null,HttpStatusCode.NoContent);
        foreach(var saved in uploadStreams) saved.Dispose();
        return count;
    }
}
