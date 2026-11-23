-- Run with the reviewed #DepartmentImport staging table in the same transaction.
-- GROUP_ID may be the literal "Company", so keep it as text rather than UNIQUEIDENTIFIER.
SET NOCOUNT ON;
SET XACT_ABORT ON;
IF OBJECT_ID('tempdb..#DepartmentImport') IS NULL THROW 50010, N'Review and stage the department import first.', 1;
IF COL_LENGTH(N'dbo.departments',N'group_id') IS NULL ALTER TABLE dbo.departments ADD group_id nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.departments',N'parent_id') IS NULL ALTER TABLE dbo.departments ADD parent_id int NULL;
IF COL_LENGTH(N'dbo.departments',N'group_type') IS NULL ALTER TABLE dbo.departments ADD group_type nvarchar(20) NULL;
IF COL_LENGTH(N'dbo.departments',N'group_code') IS NULL ALTER TABLE dbo.departments ADD group_code nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.departments',N'company_id') IS NULL ALTER TABLE dbo.departments ADD company_id nvarchar(50) NULL;
IF COL_LENGTH(N'dbo.departments',N'is_active') IS NULL ALTER TABLE dbo.departments ADD is_active bit NOT NULL CONSTRAINT DF_departments_is_active DEFAULT(1) WITH VALUES;
IF COL_LENGTH(N'dbo.departments',N'lft') IS NULL ALTER TABLE dbo.departments ADD lft int NULL;
IF COL_LENGTH(N'dbo.departments',N'rgt') IS NULL ALTER TABLE dbo.departments ADD rgt int NULL;
IF COL_LENGTH(N'dbo.departments',N'depth') IS NULL ALTER TABLE dbo.departments ADD depth int NULL;
IF OBJECT_ID(N'dbo.UQ_departments_name',N'UQ') IS NOT NULL ALTER TABLE dbo.departments DROP CONSTRAINT UQ_departments_name;
IF EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.departments') AND name=N'UQ_departments_name')
    DROP INDEX UQ_departments_name ON dbo.departments;
GO
-- Keep integer IDs already referenced by projects; external group IDs are the import identity.
UPDATE d SET name=s.name,group_id=s.group_id,group_type=s.group_type,group_code=s.group_code,
    company_id=s.company_id,is_active=1,lft=s.lft,rgt=s.rgt,depth=s.depth
FROM dbo.departments d JOIN #DepartmentImport s ON s.assigned_id=d.id;
INSERT dbo.departments(name,group_id,group_type,group_code,company_id,is_active,lft,rgt,depth)
SELECT name,group_id,group_type,group_code,company_id,1,lft,rgt,depth FROM #DepartmentImport WHERE assigned_id IS NULL;
UPDATE s SET assigned_id=d.id FROM #DepartmentImport s JOIN dbo.departments d ON d.group_id=s.group_id;
IF EXISTS(SELECT 1 FROM #DepartmentImport WHERE assigned_id IS NULL) THROW 50011,N'Missing assigned department ID.',1;
IF EXISTS(SELECT 1 FROM #DepartmentImport s LEFT JOIN #DepartmentImport p ON p.group_id=s.parent_group_id WHERE s.parent_group_id IS NOT NULL AND p.group_id IS NULL)
    THROW 50012,N'Missing active parent in source.',1;
UPDATE d SET parent_id=p.assigned_id FROM dbo.departments d JOIN #DepartmentImport s ON s.assigned_id=d.id LEFT JOIN #DepartmentImport p ON p.group_id=s.parent_group_id;
IF EXISTS(SELECT 1 FROM dbo.projects p LEFT JOIN #DepartmentImport s ON s.assigned_id=p.requester_department_id WHERE p.requester_department_id IS NOT NULL AND s.assigned_id IS NULL)
    THROW 50013,N'A project still references a department not present in the active source. No deletion allowed.',1;
DELETE d FROM dbo.departments d LEFT JOIN #DepartmentImport s ON s.assigned_id=d.id WHERE s.assigned_id IS NULL;
IF EXISTS(SELECT 1 FROM dbo.departments d JOIN dbo.departments p ON p.id=d.parent_id WHERE d.depth<>p.depth+1 OR NOT(p.lft<d.lft AND d.rgt<p.rgt))
    THROW 50014,N'Parent/depth/nested-set integrity failed.',1;
IF EXISTS(SELECT 1 FROM dbo.departments WHERE parent_id IS NULL AND depth<>0) THROW 50014,N'Invalid root depth.',1;
ALTER TABLE dbo.departments ALTER COLUMN group_id nvarchar(50) NOT NULL;
ALTER TABLE dbo.departments ALTER COLUMN group_type nvarchar(20) NOT NULL;
ALTER TABLE dbo.departments ALTER COLUMN lft int NOT NULL;
ALTER TABLE dbo.departments ALTER COLUMN rgt int NOT NULL;
ALTER TABLE dbo.departments ALTER COLUMN depth int NOT NULL;
GO
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.departments') AND name=N'UQ_departments_group_id')
    CREATE UNIQUE INDEX UQ_departments_group_id ON dbo.departments(group_id);
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.departments') AND name=N'IX_departments_name')
    CREATE INDEX IX_departments_name ON dbo.departments(name);
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.departments') AND name=N'IX_departments_parent_id')
    CREATE INDEX IX_departments_parent_id ON dbo.departments(parent_id);
IF OBJECT_ID(N'dbo.FK_departments_parent',N'F') IS NULL
    ALTER TABLE dbo.departments WITH CHECK ADD CONSTRAINT FK_departments_parent FOREIGN KEY(parent_id) REFERENCES dbo.departments(id);
IF OBJECT_ID(N'dbo.CK_departments_parent',N'C') IS NULL
    ALTER TABLE dbo.departments WITH CHECK ADD CONSTRAINT CK_departments_parent CHECK(parent_id IS NULL OR parent_id<>id);
IF OBJECT_ID(N'dbo.CK_departments_tree',N'C') IS NULL
    ALTER TABLE dbo.departments WITH CHECK ADD CONSTRAINT CK_departments_tree CHECK(lft>=1 AND rgt>lft AND depth>=0);
IF OBJECT_ID(N'dbo.CK_departments_group_type',N'C') IS NULL
    ALTER TABLE dbo.departments WITH CHECK ADD CONSTRAINT CK_departments_group_type CHECK(group_type IN(N'Department',N'Group'));
IF OBJECT_ID(N'dbo.CK_departments_group_id',N'C') IS NULL
    ALTER TABLE dbo.departments WITH CHECK ADD CONSTRAINT CK_departments_group_id CHECK(LEN(LTRIM(RTRIM(group_id)))>0);
