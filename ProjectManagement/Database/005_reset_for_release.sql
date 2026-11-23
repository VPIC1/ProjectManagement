-- DESTRUCTIVE: run only when intentionally clearing projects/tasks for release.
-- Back up first. Employee rows are preserved and verified within the transaction.
SET NOCOUNT ON;
SET XACT_ABORT ON;
BEGIN TRY
    BEGIN TRANSACTION;
    SELECT id, code, name INTO #ReleaseUsers
    FROM dbo.project_users WITH (TABLOCKX, HOLDLOCK);
    DELETE FROM dbo.tasks WITH (TABLOCKX);
    DELETE FROM dbo.projects WITH (TABLOCKX);
    DELETE FROM dbo.project_code_counters WITH (TABLOCKX);
    -- Do not reseed project/task identities: old browser sessions must not address new rows.
    IF EXISTS (SELECT id, code, name FROM #ReleaseUsers EXCEPT SELECT id, code, name FROM dbo.project_users)
       OR EXISTS (SELECT id, code, name FROM dbo.project_users EXCEPT SELECT id, code, name FROM #ReleaseUsers)
        THROW 50001, 'Employee data changed; release reset rolled back.', 1;
    DROP TABLE #ReleaseUsers;
    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
