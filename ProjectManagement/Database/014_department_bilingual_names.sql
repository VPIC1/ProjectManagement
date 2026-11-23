-- Requires reviewed #DepartmentNames(id, name_vi, name_zh) for every existing department.
ALTER TABLE dbo.departments ADD name_vi nvarchar(255) NULL, name_zh nvarchar(255) NULL;
GO
UPDATE d SET name_vi = n.name_vi, name_zh = n.name_zh
FROM dbo.departments d INNER JOIN #DepartmentNames n ON n.id = d.id;
IF EXISTS (SELECT 1 FROM dbo.departments WHERE COALESCE(NULLIF(LTRIM(RTRIM(name_vi)), ''), NULLIF(LTRIM(RTRIM(name_zh)), '')) IS NULL)
    THROW 50020, 'Department translation plan is incomplete.', 1;
DROP INDEX IX_departments_name ON dbo.departments;
ALTER TABLE dbo.departments DROP COLUMN name;
ALTER TABLE dbo.departments WITH CHECK ADD CONSTRAINT CK_departments_name CHECK (
    NULLIF(LTRIM(RTRIM(name_vi)), '') IS NOT NULL OR NULLIF(LTRIM(RTRIM(name_zh)), '') IS NOT NULL);
CREATE INDEX IX_departments_name_vi ON dbo.departments(name_vi);
CREATE INDEX IX_departments_name_zh ON dbo.departments(name_zh);
