SET NOCOUNT ON;
SET XACT_ABORT ON;
IF OBJECT_ID(N'dbo.projects', N'U') IS NULL OR OBJECT_ID(N'dbo.tasks', N'U') IS NULL
    THROW 50001, N'Chọn đúng database có projects và tasks.', 1;
BEGIN TRANSACTION;
-- Chỉ thêm cột nullable. Giữ nguyên nội dung cũ, không suy đoán chỗ ngắt Việt/Trung.
IF COL_LENGTH(N'dbo.projects', N'project_name_vi') IS NULL ALTER TABLE dbo.projects ADD project_name_vi NVARCHAR(255) NULL;
IF COL_LENGTH(N'dbo.projects', N'project_name_zh') IS NULL ALTER TABLE dbo.projects ADD project_name_zh NVARCHAR(255) NULL;
IF COL_LENGTH(N'dbo.projects', N'description_vi') IS NULL ALTER TABLE dbo.projects ADD description_vi NVARCHAR(MAX) NULL;
IF COL_LENGTH(N'dbo.projects', N'description_zh') IS NULL ALTER TABLE dbo.projects ADD description_zh NVARCHAR(MAX) NULL;
IF COL_LENGTH(N'dbo.tasks', N'task_name_vi') IS NULL ALTER TABLE dbo.tasks ADD task_name_vi NVARCHAR(255) NULL;
IF COL_LENGTH(N'dbo.tasks', N'task_name_zh') IS NULL ALTER TABLE dbo.tasks ADD task_name_zh NVARCHAR(255) NULL;
IF COL_LENGTH(N'dbo.tasks', N'description_vi') IS NULL ALTER TABLE dbo.tasks ADD description_vi NVARCHAR(MAX) NULL;
IF COL_LENGTH(N'dbo.tasks', N'description_zh') IS NULL ALTER TABLE dbo.tasks ADD description_zh NVARCHAR(MAX) NULL;
COMMIT;
