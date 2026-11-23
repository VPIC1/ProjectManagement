-- Run after 010 and after reviewing/backing up the bilingual content.
-- Deploy the matching application version: old binaries reference the removed columns.
SET NOCOUNT ON;
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF COL_LENGTH(N'dbo.projects', N'project_name_vi') IS NULL OR COL_LENGTH(N'dbo.tasks', N'task_name_zh') IS NULL
    THROW 50001, N'Apply 010_bilingual_content.sql first.', 1;
-- Require all existing names/descriptions to have been moved, never silently discard a legacy-only value.
IF COL_LENGTH(N'dbo.projects', N'project_name') IS NOT NULL
    EXEC(N'IF EXISTS (SELECT 1 FROM dbo.projects WHERE NULLIF(LTRIM(RTRIM(project_name_vi)), N'''') IS NULL AND NULLIF(LTRIM(RTRIM(project_name_zh)), N'''') IS NULL) THROW 50002, N''Project names have not been migrated.'', 1;');
IF COL_LENGTH(N'dbo.tasks', N'task_name') IS NOT NULL
    EXEC(N'IF EXISTS (SELECT 1 FROM dbo.tasks WHERE NULLIF(LTRIM(RTRIM(task_name_vi)), N'''') IS NULL AND NULLIF(LTRIM(RTRIM(task_name_zh)), N'''') IS NULL) THROW 50002, N''Task names have not been migrated.'', 1;');
IF COL_LENGTH(N'dbo.projects', N'description') IS NOT NULL
    EXEC(N'IF EXISTS (SELECT 1 FROM dbo.projects WHERE NULLIF(description,N'''') IS NOT NULL AND NULLIF(description_vi,N'''') IS NULL AND NULLIF(description_zh,N'''') IS NULL) THROW 50003, N''Project descriptions have not been migrated.'', 1;');
IF COL_LENGTH(N'dbo.tasks', N'description') IS NOT NULL
    EXEC(N'IF EXISTS (SELECT 1 FROM dbo.tasks WHERE NULLIF(description,N'''') IS NOT NULL AND NULLIF(description_vi,N'''') IS NULL AND NULLIF(description_zh,N'''') IS NULL) THROW 50003, N''Task descriptions have not been migrated.'', 1;');

-- Only defaults attached to the four retired columns may be removed.
DECLARE @dropDefaults nvarchar(max) = N'';
SELECT @dropDefaults += N'ALTER TABLE '+QUOTENAME(OBJECT_SCHEMA_NAME(c.object_id))+N'.'+QUOTENAME(OBJECT_NAME(c.object_id))+N' DROP CONSTRAINT '+QUOTENAME(d.name)+N';'
FROM sys.columns c JOIN sys.default_constraints d ON d.parent_object_id=c.object_id AND d.parent_column_id=c.column_id
WHERE (c.object_id=OBJECT_ID(N'dbo.projects') AND c.name IN(N'project_name',N'description'))
   OR (c.object_id=OBJECT_ID(N'dbo.tasks') AND c.name IN(N'task_name',N'description'));
IF @dropDefaults<>N'' EXEC sp_executesql @dropDefaults;
IF COL_LENGTH(N'dbo.projects', N'project_name') IS NOT NULL ALTER TABLE dbo.projects DROP COLUMN project_name;
IF COL_LENGTH(N'dbo.projects', N'description') IS NOT NULL ALTER TABLE dbo.projects DROP COLUMN description;
IF COL_LENGTH(N'dbo.tasks', N'task_name') IS NOT NULL ALTER TABLE dbo.tasks DROP COLUMN task_name;
IF COL_LENGTH(N'dbo.tasks', N'description') IS NOT NULL ALTER TABLE dbo.tasks DROP COLUMN description;
IF OBJECT_ID(N'dbo.CK_projects_localized_name', N'C') IS NULL
    ALTER TABLE dbo.projects WITH CHECK ADD CONSTRAINT CK_projects_localized_name CHECK
      (NULLIF(LTRIM(RTRIM(project_name_vi)), N'') IS NOT NULL OR NULLIF(LTRIM(RTRIM(project_name_zh)), N'') IS NOT NULL);
IF OBJECT_ID(N'dbo.CK_tasks_localized_name', N'C') IS NULL
    ALTER TABLE dbo.tasks WITH CHECK ADD CONSTRAINT CK_tasks_localized_name CHECK
      (NULLIF(LTRIM(RTRIM(task_name_vi)), N'') IS NOT NULL OR NULLIF(LTRIM(RTRIM(task_name_zh)), N'') IS NOT NULL);
COMMIT;
