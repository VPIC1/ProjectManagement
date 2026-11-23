using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using ProjectManagement.Data;
using ProjectManagement.Models;

namespace ProjectManagement.ApiTests;

internal static class DepartmentHierarchyVerification
{
    public static async Task<int> Run(HttpClient client, IServiceProvider services)
    {
        var count=0;void Check(bool result,string message){if(!result)throw new Exception("Department hierarchy: "+message);count++;}
        int groupId,inactiveId,childId;
        using(var scope=services.CreateScope())
        {
            var db=scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var root=new Department{Name="Công ty thử",NameZh="測試公司",GroupId="HIER-ROOT",SortOrder=1};
            var a=new Department{Name="Khối A",NameZh="甲部門",GroupId="HIER-A",Parent=root,SortOrder=2};
            var b=new Department{Name="Khối B",NameZh="乙部門",GroupId="HIER-B",Parent=root,SortOrder=6};
            var childA=new Department{Name="Phòng IT",NameZh="資訊室",GroupId="HIER-IT-A",Parent=a,GroupCode="IT",SortOrder=3};
            var childB=new Department{Name="Phòng IT",NameZh="資訊室",GroupId="HIER-IT-B",Parent=b,GroupCode="IT",SortOrder=7};
            var inactive=new Department{Name="Đã ngừng",GroupId="HIER-OFF",Parent=root,IsActive=false,SortOrder=10};
            var group=new Department{Name="Nhóm",GroupId="HIER-GROUP",GroupType="Group",Parent=root,SortOrder=12};
            db.Departments.AddRange(root,a,b,childA,childB,inactive,group);await db.SaveChangesAsync();
            groupId=group.Id;inactiveId=inactive.Id;childId=childB.Id;
            Check(childA.Id!=childB.Id,"same name under distinct parents is allowed");
        }
        var directory=await client.GetFromJsonAsync<JsonElement>("/api/departments");
        var nodes=directory.EnumerateArray().Where(n=>n.GetProperty("groupId").GetString()!.StartsWith("HIER-")).ToArray();
        Check(nodes.Length==6,"inactive nodes excluded");
        var duplicate=nodes.Where(n=>n.GetProperty("name").GetString()=="Phòng IT").ToArray();
        Check(duplicate.Length==2&&duplicate.Select(n=>n.GetProperty("path").GetString()).Distinct().Count()==2,"full paths disambiguate duplicate names");
        Check(nodes.Single(n=>n.GetProperty("id").GetInt32()==groupId).GetProperty("selectable").GetBoolean()==false,"membership groups cannot be selected as departments");
        var bilingualNode=nodes.Single(n=>n.GetProperty("id").GetInt32()==childId);
        Check(bilingualNode.GetProperty("nameVi").GetString()=="Phòng IT" && bilingualNode.GetProperty("nameZh").GetString()=="資訊室", "two separate names returned");
        Check(bilingualNode.GetProperty("pathZh").GetString()=="測試公司 / 乙部門 / 資訊室", "Chinese ancestor path uses Chinese names");
        Check(!bilingualNode.TryGetProperty("depth",out _) && !bilingualNode.TryGetProperty("rgt",out _) && !bilingualNode.TryGetProperty("companyId",out _), "redundant tree metadata removed");
        var tree=await client.GetFromJsonAsync<JsonElement>("/api/departments/tree");
        var treeRoot=tree.EnumerateArray().Single(n=>n.GetProperty("groupId").GetString()=="HIER-ROOT");
        Check(treeRoot.GetProperty("children").GetArrayLength()==3,"tree preserves parent-child branches");
        foreach(var rejected in new[]{groupId,inactiveId})
        {using var response=await client.PostAsJsonAsync("/api/projects",new{projectNameVi="Hierarchy invalid",requesterDepartmentId=rejected});Check(response.StatusCode==HttpStatusCode.BadRequest,"reject inactive or non-department assignments");}
        using(var response=await client.PostAsJsonAsync("/api/projects",new{projectNameVi="Hierarchy valid",requesterDepartmentId=childId}))
        {
            Check(response.StatusCode==HttpStatusCode.Created,"active child selection remains valid");
            var project=await response.Content.ReadFromJsonAsync<JsonElement>();
            Check(project.GetProperty("requesterDepartmentId").GetInt32()==childId,"numeric project reference preserved");
            Check(project.GetProperty("requesterDepartmentNameZh").GetString()=="資訊室", "project projection includes Chinese department name");
            var zhExport=await client.GetByteArrayAsync("/api/projects/"+project.GetProperty("id").GetInt32()+"/export?language=zh");
            using(var zhBook=new ClosedXML.Excel.XLWorkbook(new MemoryStream(zhExport)))
                Check(zhBook.Worksheet("DuAn").Cell(9,3).GetString().Contains("乙部門"), "Chinese export uses Chinese path to disambiguate names");
            using(var zhForm=new MultipartFormDataContent())
            {
                zhForm.Add(new ByteArrayContent(zhExport), "file", "zh.xlsx");
                using var zhPreview=await client.PostAsync("/api/projects/import/preview",zhForm);
                var zhRoundtrip=await zhPreview.Content.ReadFromJsonAsync<JsonElement>();
                Check(zhRoundtrip.GetProperty("project").GetProperty("requesterDepartmentId").GetInt32()==childId, "Chinese path roundtrip restores exact ID");
            }
            var export = await client.GetByteArrayAsync("/api/projects/"+project.GetProperty("id").GetInt32()+"/export");
            using var workbook = new ClosedXML.Excel.XLWorkbook(new MemoryStream(export));
            Check(workbook.Worksheet("DuAn").Cell(9,3).GetString().Contains("Khối B"), "Excel export disambiguates duplicate department names");
            var previewStreams = new List<MemoryStream>();
            async Task<JsonElement> Preview()
            {
                var stream = new MemoryStream();previewStreams.Add(stream);workbook.SaveAs(stream);
                using var form = new MultipartFormDataContent();form.Add(new ByteArrayContent(stream.ToArray()), "file", "hierarchy.xlsx");
                using var preview = await client.PostAsync("/api/projects/import/preview", form);
                return await preview.Content.ReadFromJsonAsync<JsonElement>();
            }
            var roundtrip = await Preview();
            Check(roundtrip.GetProperty("project").GetProperty("requesterDepartmentId").GetInt32() == childId, "Excel path roundtrip restores the exact department ID");
            workbook.Worksheet("DuAn").Cell(9,3).Value = "Phòng IT";
            var ambiguous = await Preview();
            Check(ambiguous.GetProperty("errors").EnumerateArray().Any(e => e.GetProperty("row").GetInt32()==9), "Ambiguous department name reports an error instead of choosing the first match");
            foreach(var stream in previewStreams) stream.Dispose();
            await client.DeleteAsync("/api/projects/"+project.GetProperty("id").GetInt32());
        }
        using(var scope=services.CreateScope())await scope.ServiceProvider.GetRequiredService<ApplicationDbContext>().Departments.Where(d=>d.GroupId.StartsWith("HIER-")).ExecuteDeleteAsync();
        return count;
    }
}
