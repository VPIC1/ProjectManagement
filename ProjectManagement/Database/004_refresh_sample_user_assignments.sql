-- Update only existing marked sample rows. Never recreate deleted samples.
SET NOCOUNT ON;
SET XACT_ABORT ON;
BEGIN TRY
    BEGIN TRANSACTION;
    SELECT code, name, ROW_NUMBER() OVER (ORDER BY code) AS rn INTO #Users FROM dbo.project_users;
    DECLARE @Count INT = (SELECT COUNT(*) FROM #Users);
    IF @Count = 0 THROW 50001, 'Import the employee directory first.', 1;
    SELECT id INTO #Projects FROM dbo.projects WHERE description LIKE N'[[]DEMO_PM_V1:%';
    SELECT t.id INTO #Tasks FROM dbo.tasks t
        INNER JOIN dbo.projects p ON p.project_code = t.project_code
        INNER JOIN #Projects sample ON sample.id = p.id
        WHERE t.description LIKE N'[[]DEMO_PM_V1:%';
    UPDATE p SET manager = u.code, updated_date = SYSDATETIME()
    FROM dbo.projects p INNER JOIN #Projects sample ON sample.id = p.id
    INNER JOIN #Users u ON u.rn = (p.id - 1) % @Count + 1
    WHERE NULLIF(LTRIM(RTRIM(p.manager)), N'') IS NULL OR EXISTS (
        SELECT 1 FROM STRING_SPLIT(p.manager, N',') s
        WHERE NOT EXISTS (SELECT 1 FROM #Users d WHERE d.code = LTRIM(RTRIM(s.value))));
    UPDATE p SET requester = u.name, updated_date = SYSDATETIME()
    FROM dbo.projects p INNER JOIN #Projects sample ON sample.id = p.id
    INNER JOIN #Users u ON u.rn = (p.id - 1) % @Count + 1
    WHERE NOT EXISTS (SELECT 1 FROM #Users d WHERE d.name = p.requester);
    UPDATE t SET PIC = p.manager, updated_date = SYSDATETIME()
    FROM dbo.tasks t INNER JOIN #Tasks sample ON sample.id = t.id
    INNER JOIN dbo.projects p ON p.project_code = t.project_code
    WHERE NULLIF(LTRIM(RTRIM(t.PIC)), N'') IS NULL OR EXISTS (
        SELECT 1 FROM STRING_SPLIT(t.PIC, N',') s WHERE NOT EXISTS (
            SELECT 1 FROM STRING_SPLIT(p.manager, N',') m WHERE LTRIM(RTRIM(m.value)) = LTRIM(RTRIM(s.value))));
    DROP TABLE #Tasks;
    DROP TABLE #Projects;
    DROP TABLE #Users;
    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
