using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ProjectManagement.Models;

namespace ProjectManagement.Data;

// Mapping schema hiện có. Ứng dụng không tự tạo bảng hoặc tự nâng cấp DB khi khởi động.
public class ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : DbContext(options)
{
    public DbSet<Project> Projects => Set<Project>();
    public DbSet<ProjectTask> Tasks => Set<ProjectTask>();
    public DbSet<ProjectUser> ProjectUsers => Set<ProjectUser>();

    public DbSet<Department> Departments => Set<Department>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        var user = modelBuilder.Entity<ProjectUser>();
        user.ToTable("project_users", "dbo");
        user.HasKey(u => u.Id).HasName("PK_project_users");
        user.Property(u => u.Id).HasColumnName("id").UseIdentityColumn();
        user.Property(u => u.Code).HasColumnName("code").HasMaxLength(50).IsRequired();
        user.Property(u => u.Name).HasColumnName("name").HasMaxLength(255).IsRequired();
        user.HasIndex(u => u.Code).IsUnique().HasDatabaseName("UQ_project_users_user_code");

        var department = modelBuilder.Entity<Department>();
        department.ToTable("departments", "dbo", table =>
        {
            table.HasCheckConstraint("CK_departments_name", "NULLIF(LTRIM(RTRIM([name_vi])), '') IS NOT NULL OR NULLIF(LTRIM(RTRIM([name_zh])), '') IS NOT NULL");
            table.HasCheckConstraint("CK_departments_parent", "[parent_id] IS NULL OR [parent_id] <> [id]");
            table.HasCheckConstraint("CK_departments_sort_order", "[sort_order] >= 0");
            table.HasCheckConstraint("CK_departments_group_type", "[group_type] IN ('Department', 'Group')");
            table.HasCheckConstraint("CK_departments_group_id", "LEN(LTRIM(RTRIM([group_id]))) > 0");
        });
        department.HasKey(d => d.Id).HasName("PK_departments");
        department.Property(d => d.Id).HasColumnName("id").UseIdentityColumn();
        department.Property(d => d.NameVi).HasColumnName("name_vi").HasMaxLength(255);
        department.Property(d => d.NameZh).HasColumnName("name_zh").HasMaxLength(255);
        department.Property(d => d.GroupId).HasColumnName("group_id").HasMaxLength(50).IsRequired();
        department.Property(d => d.GroupType).HasColumnName("group_type").HasMaxLength(20).IsRequired();
        department.Property(d => d.GroupCode).HasColumnName("group_code").HasMaxLength(50);
        department.Property(d => d.IsActive).HasColumnName("is_active").HasDefaultValue(true).IsRequired();
        department.Property(d => d.ParentId).HasColumnName("parent_id");
        department.Property(d => d.SortOrder).HasColumnName("sort_order");
        department.HasIndex(d => d.GroupId).IsUnique().HasDatabaseName("UQ_departments_group_id");
        department.HasIndex(d => d.NameVi).HasDatabaseName("IX_departments_name_vi");
        department.HasIndex(d => d.NameZh).HasDatabaseName("IX_departments_name_zh");
        department.HasIndex(d => d.ParentId).HasDatabaseName("IX_departments_parent_id");
        department.HasOne(d => d.Parent).WithMany(d => d.Children).HasForeignKey(d => d.ParentId)
            .OnDelete(DeleteBehavior.NoAction).HasConstraintName("FK_departments_parent");

        var counter = modelBuilder.Entity<ProjectCodeCounter>();
        counter.ToTable("project_code_counters", "dbo");
        counter.HasKey(c => new { c.Prefix, c.Period }).HasName("PK_project_code_counters");
        counter.Property(c => c.Prefix).HasColumnName("prefix").HasMaxLength(10).IsUnicode(false);
        counter.Property(c => c.Period).HasColumnName("period").HasMaxLength(4).IsUnicode(false);
        counter.Property(c => c.LastNumber).HasColumnName("last_number");

        var project = modelBuilder.Entity<Project>();
        project.ToTable("projects", "dbo", table =>
        {
            // Compatible with the optional updated_date trigger in the existing schema.
            table.UseSqlOutputClause(false);
            table.HasCheckConstraint("CK_projects_localized_name", "NULLIF(LTRIM(RTRIM([project_name_vi])), '') IS NOT NULL OR NULLIF(LTRIM(RTRIM([project_name_zh])), '') IS NOT NULL");
            table.HasCheckConstraint("CK_projects_status", "[status] COLLATE Latin1_General_100_BIN2 IN (N'PENDING', N'COMPLETE', N'HOLD', N'CANCEL')");
            table.HasCheckConstraint("CK_projects_actual_dates", "[actual_start_date] IS NULL OR [actual_end_date] IS NULL OR [actual_end_date] >= [actual_start_date]");
            table.HasCheckConstraint("CK_projects_dates", "[end_date] IS NULL OR [start_date] IS NULL OR [end_date] >= [start_date]");
        });
        ConfigureCommonColumns(project);
        project.Property(p => p.ProjectNameVi).HasColumnName("project_name_vi").HasMaxLength(255);
        project.Property(p => p.ProjectNameZh).HasColumnName("project_name_zh").HasMaxLength(255);
        project.Property(p => p.DescriptionVi).HasColumnName("description_vi").HasColumnType("nvarchar(max)");
        project.Property(p => p.DescriptionZh).HasColumnName("description_zh").HasColumnType("nvarchar(max)");
        project.Property(p => p.ProjectCode).HasColumnName("project_code").HasMaxLength(50).IsRequired();
        project.HasAlternateKey(p => p.ProjectCode).HasName("UQ_projects_project_code");
        project.Property(p => p.Manager).HasColumnName("manager").HasMaxLength(255);
        project.Property(p => p.Requester).HasColumnName("requester").HasMaxLength(255);

        project.Property(p => p.RequesterDepartmentId).HasColumnName("requester_department_id");
        project.HasOne(p => p.RequesterDepartment).WithMany()
            .HasForeignKey(p => p.RequesterDepartmentId).OnDelete(DeleteBehavior.NoAction)
            .HasConstraintName("FK_projects_departments");

        var task = modelBuilder.Entity<ProjectTask>();
        task.ToTable("tasks", "dbo", table =>
        {
            table.UseSqlOutputClause(false);
            table.HasCheckConstraint("CK_tasks_localized_name", "NULLIF(LTRIM(RTRIM([task_name_vi])), '') IS NOT NULL OR NULLIF(LTRIM(RTRIM([task_name_zh])), '') IS NOT NULL");
            table.HasCheckConstraint("CK_tasks_status", "[status] COLLATE Latin1_General_100_BIN2 IN (N'PENDING', N'COMPLETE', N'HOLD', N'CANCEL')");
            table.HasCheckConstraint("CK_tasks_actual_dates", "[actual_start_date] IS NULL OR [actual_end_date] IS NULL OR [actual_end_date] >= [actual_start_date]");
            table.HasCheckConstraint("CK_tasks_dates", "[end_date] IS NULL OR [start_date] IS NULL OR [end_date] >= [start_date]");
            table.HasCheckConstraint("CK_tasks_progress", "[progress] BETWEEN 0 AND 100");
        });
        ConfigureCommonColumns(task);
        task.Property(p => p.TaskNameVi).HasColumnName("task_name_vi").HasMaxLength(255);
        task.Property(p => p.TaskNameZh).HasColumnName("task_name_zh").HasMaxLength(255);
        task.Property(p => p.DescriptionVi).HasColumnName("description_vi").HasColumnType("nvarchar(max)");
        task.Property(p => p.DescriptionZh).HasColumnName("description_zh").HasColumnType("nvarchar(max)");
        task.Property(t => t.ProjectCode).HasColumnName("project_code").HasMaxLength(50).IsRequired();
        task.Property(t => t.PIC).HasColumnName("PIC").HasMaxLength(255);
        task.Property(t => t.Progress).HasColumnName("progress").HasDefaultValue(0).IsRequired();
        task.HasIndex(t => t.ProjectCode).HasDatabaseName("IX_tasks_project_code");
        task.HasOne(t => t.Project).WithMany(p => p.Tasks)
            .HasForeignKey(t => t.ProjectCode).HasPrincipalKey(p => p.ProjectCode)
            .OnDelete(DeleteBehavior.NoAction).HasConstraintName("FK_tasks_projects");
    }

    private static void ConfigureCommonColumns<TEntity>(EntityTypeBuilder<TEntity> entity)
        where TEntity : class
    {
        entity.HasKey("Id");
        entity.Property<int>("Id").HasColumnName("id").UseIdentityColumn();
        entity.Property<WorkStatus>("Status").HasColumnName("status")
            .HasConversion<string>().HasMaxLength(20).HasDefaultValue(WorkStatus.PENDING).IsRequired();
        entity.Property<DateOnly?>("StartDate").HasColumnName("start_date").HasColumnType("date");
        entity.Property<DateOnly?>("EndDate").HasColumnName("end_date").HasColumnType("date");
        entity.Property<DateOnly?>("ActualStartDate").HasColumnName("actual_start_date").HasColumnType("date");
        entity.Property<DateOnly?>("ActualEndDate").HasColumnName("actual_end_date").HasColumnType("date");
        entity.Property<DateTime>("CreatedDate").HasColumnName("created_date")
            .HasColumnType("datetime2(0)").HasDefaultValueSql("SYSDATETIME()");
        entity.Property<DateTime>("UpdatedDate").HasColumnName("updated_date")
            .HasColumnType("datetime2(0)").HasDefaultValueSql("SYSDATETIME()");
    }

    public override int SaveChanges(bool acceptAllChangesOnSuccess)
    {
        PrepareChanges();
        return base.SaveChanges(acceptAllChangesOnSuccess);
    }

    public override Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
    {
        PrepareChanges();
        return base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
    }

    private void PrepareChanges()
    {
        foreach (var entry in ChangeTracker.Entries()
                     .Where(e => e.Entity is Project or ProjectTask &&
                                 e.State is EntityState.Added or EntityState.Modified))
        {
            var status = (WorkStatus)entry.Property("Status").CurrentValue!;
            if (!Enum.IsDefined(status))
                throw new ValidationException("Status must be PENDING, COMPLETE, HOLD or CANCEL.");

            var start = (DateOnly?)entry.Property("StartDate").CurrentValue;
            var end = (DateOnly?)entry.Property("EndDate").CurrentValue;
            if (start.HasValue && end.HasValue && end.Value < start.Value)
                throw new ValidationException("EndDate must be on or after StartDate.");

            var actualStart = (DateOnly?)entry.Property("ActualStartDate").CurrentValue;
            var actualEnd = (DateOnly?)entry.Property("ActualEndDate").CurrentValue;
            if (actualStart.HasValue && actualEnd.HasValue && actualEnd.Value < actualStart.Value)
                throw new ValidationException("Ngày kết thúc thực tế không được trước ngày bắt đầu thực tế. / 实际结束日期不能早于实际开始日期。");

            if (entry.State == EntityState.Modified)
            {
                entry.Property("CreatedDate").IsModified = false;
                // Without a database trigger, updates use the application server local time.
                entry.Property("UpdatedDate").CurrentValue = DateTime.Now;
                entry.Property("UpdatedDate").IsModified = true;
            }
        }
    }
}
