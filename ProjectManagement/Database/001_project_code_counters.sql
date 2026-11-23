-- Run once in the same database as dbo.projects, before using POST /api/projects.
-- Counters are independent for each prefix and month.
-- Do not clear this table when deleting projects.
IF OBJECT_ID(N'dbo.project_code_counters', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.project_code_counters (
        prefix VARCHAR(10) NOT NULL,
        period VARCHAR(4) NOT NULL,
        last_number BIGINT NOT NULL,
        CONSTRAINT PK_project_code_counters PRIMARY KEY (prefix, period)
    );
END;
ELSE IF COL_LENGTH(N'dbo.project_code_counters', N'prefix') IS NULL
BEGIN
    -- Historical counters belonged to MIS. Preserve their reserved numbers.
    BEGIN TRANSACTION;
    BEGIN TRY
        ALTER TABLE dbo.project_code_counters ADD prefix VARCHAR(10) NOT NULL
            CONSTRAINT DF_project_code_counters_prefix DEFAULT ('MIS') WITH VALUES;
        ALTER TABLE dbo.project_code_counters DROP CONSTRAINT PK_project_code_counters;
        EXEC(N'ALTER TABLE dbo.project_code_counters ADD CONSTRAINT PK_project_code_counters PRIMARY KEY (prefix, period)');
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
-- The application login needs SELECT, INSERT and UPDATE on this table.
