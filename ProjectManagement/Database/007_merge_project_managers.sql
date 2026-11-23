-- Deploy the matching backend together with this schema upgrade. Back up projects first.
SET NOCOUNT ON;
SET XACT_ABORT ON;
IF COL_LENGTH(N'dbo.projects', N'supporter') IS NOT NULL
EXEC sys.sp_executesql N'
BEGIN TRY
    BEGIN TRANSACTION;
    SELECT p.id, merged.codes INTO #MergedManagers
    FROM dbo.projects p WITH (TABLOCKX, HOLDLOCK)
    CROSS APPLY (SELECT NULLIF(STUFF((
        SELECT N'','' + c.code FROM (
            SELECT DISTINCT LTRIM(RTRIM(value)) AS code
            FROM STRING_SPLIT(CONCAT(p.manager, N'','', p.supporter), N'','')
            WHERE LTRIM(RTRIM(value)) <> N''''
        ) c ORDER BY c.code FOR XML PATH(''''), TYPE
    ).value(''.'', ''nvarchar(max)''), 1, 1, N''''), N'''') AS codes) merged;
    IF EXISTS (SELECT 1 FROM #MergedManagers WHERE LEN(codes) > 255)
        THROW 50001, ''Merged manager list exceeds 255 characters. Nothing was changed.'', 1;
    UPDATE p SET manager = m.codes
    FROM dbo.projects p INNER JOIN #MergedManagers m ON m.id = p.id;
    IF EXISTS (
        SELECT p.id, LTRIM(RTRIM(s.value)) FROM dbo.projects p
        CROSS APPLY STRING_SPLIT(CONCAT(p.manager, N'','', p.supporter), N'','') s
        WHERE LTRIM(RTRIM(s.value)) <> N''''
        EXCEPT
        SELECT p.id, LTRIM(RTRIM(s.value)) FROM dbo.projects p
        CROSS APPLY STRING_SPLIT(p.manager, N'','') s
    ) THROW 50002, ''An assignment was lost. Nothing was changed.'', 1;
    DECLARE @Default SYSNAME, @Sql NVARCHAR(MAX);
    SELECT @Default = d.name FROM sys.default_constraints d
    INNER JOIN sys.columns c ON c.object_id = d.parent_object_id AND c.column_id = d.parent_column_id
    WHERE d.parent_object_id = OBJECT_ID(N''dbo.projects'') AND c.name = N''supporter'';
    IF @Default IS NOT NULL
    BEGIN
        SET @Sql = N''ALTER TABLE dbo.projects DROP CONSTRAINT '' + QUOTENAME(@Default);
        EXEC sys.sp_executesql @Sql;
    END;
    ALTER TABLE dbo.projects DROP COLUMN supporter;
    DROP TABLE #MergedManagers;
    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
';
