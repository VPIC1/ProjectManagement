-- Add manual task progress without changing task status or project progress rules.
SET NOCOUNT ON;
SET XACT_ABORT ON;
BEGIN TRY
    BEGIN TRANSACTION;
    IF COL_LENGTH(N'dbo.tasks', N'progress') IS NULL
        ALTER TABLE dbo.tasks ADD progress INT NOT NULL
            CONSTRAINT DF_tasks_progress DEFAULT (0) WITH VALUES;
    -- Upgrade an earlier 1..100 constraint/default while preserving saved progress.
    DECLARE @DefaultName SYSNAME;
    SELECT @DefaultName = dc.name FROM sys.default_constraints dc
    INNER JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
    WHERE dc.parent_object_id = OBJECT_ID(N'dbo.tasks') AND c.name = N'progress';
    IF @DefaultName IS NOT NULL
    BEGIN
        DECLARE @DropDefault NVARCHAR(MAX) = N'ALTER TABLE dbo.tasks DROP CONSTRAINT ' + QUOTENAME(@DefaultName);
        EXEC sys.sp_executesql @DropDefault;
    END;
    EXEC(N'ALTER TABLE dbo.tasks ADD CONSTRAINT DF_tasks_progress DEFAULT (0) FOR progress');
    IF EXISTS (SELECT 1 FROM sys.check_constraints
                   WHERE parent_object_id = OBJECT_ID(N'dbo.tasks') AND name = N'CK_tasks_progress')
        ALTER TABLE dbo.tasks DROP CONSTRAINT CK_tasks_progress;
    EXEC(N'ALTER TABLE dbo.tasks WITH CHECK ADD CONSTRAINT CK_tasks_progress CHECK (progress BETWEEN 0 AND 100)');
    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
