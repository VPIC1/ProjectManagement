SET NOCOUNT ON;
SET XACT_ABORT ON;

IF OBJECT_ID(N'dbo.projects', N'U') IS NULL
    THROW 50001, N'Không tìm thấy bảng dbo.projects. Hãy chọn đúng database.', 1;

BEGIN TRY
    BEGIN TRANSACTION;

    IF OBJECT_ID(N'dbo.departments', N'U') IS NULL
        CREATE TABLE dbo.departments (
            id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_departments PRIMARY KEY,
            name NVARCHAR(255) COLLATE Latin1_General_100_BIN2 NOT NULL,
            CONSTRAINT UQ_departments_name UNIQUE (name)
        );

    IF COL_LENGTH(N'dbo.projects', N'requester_department_id') IS NULL
        ALTER TABLE dbo.projects ADD requester_department_id INT NULL;

    IF NOT EXISTS (
        SELECT 1 FROM sys.foreign_keys
        WHERE parent_object_id = OBJECT_ID(N'dbo.projects') AND name = N'FK_projects_departments'
    )
        EXEC(N'ALTER TABLE dbo.projects WITH CHECK ADD CONSTRAINT FK_projects_departments
            FOREIGN KEY (requester_department_id) REFERENCES dbo.departments(id)');

    COMMIT;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK;
    THROW;
END CATCH;
