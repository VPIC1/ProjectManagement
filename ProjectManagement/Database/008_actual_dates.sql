-- Bổ sung ngày thực tế; không thay đổi ngày kế hoạch hay dữ liệu hiện có.
SET NOCOUNT ON;
SET XACT_ABORT ON;
IF OBJECT_ID(N'dbo.projects', N'U') IS NULL OR OBJECT_ID(N'dbo.tasks', N'U') IS NULL
    THROW 50001, N'Không tìm thấy projects/tasks. Hãy chọn đúng database.', 1;
BEGIN TRY
    BEGIN TRANSACTION;
    IF COL_LENGTH(N'dbo.projects', N'actual_start_date') IS NULL
        ALTER TABLE dbo.projects ADD actual_start_date DATE NULL;
    IF COL_LENGTH(N'dbo.projects', N'actual_end_date') IS NULL
        ALTER TABLE dbo.projects ADD actual_end_date DATE NULL;
    IF COL_LENGTH(N'dbo.tasks', N'actual_start_date') IS NULL
        ALTER TABLE dbo.tasks ADD actual_start_date DATE NULL;
    IF COL_LENGTH(N'dbo.tasks', N'actual_end_date') IS NULL
        ALTER TABLE dbo.tasks ADD actual_end_date DATE NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID(N'dbo.projects') AND name = N'CK_projects_actual_dates')
        EXEC(N'ALTER TABLE dbo.projects WITH CHECK ADD CONSTRAINT CK_projects_actual_dates CHECK (actual_start_date IS NULL OR actual_end_date IS NULL OR actual_end_date >= actual_start_date)');
    IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID(N'dbo.tasks') AND name = N'CK_tasks_actual_dates')
        EXEC(N'ALTER TABLE dbo.tasks WITH CHECK ADD CONSTRAINT CK_tasks_actual_dates CHECK (actual_start_date IS NULL OR actual_end_date IS NULL OR actual_end_date >= actual_start_date)');
    COMMIT;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK;
    THROW;
END CATCH;
