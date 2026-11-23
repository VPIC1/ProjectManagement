-- Apply after 012 inside a transaction, with a department backup.
-- ParentId defines the tree. Preserve the source traversal order as display order.
ALTER TABLE dbo.departments DROP CONSTRAINT CK_departments_tree;
ALTER TABLE dbo.departments DROP COLUMN rgt, depth, company_id;
EXEC sp_rename 'dbo.departments.lft', 'sort_order', 'COLUMN';
GO
ALTER TABLE dbo.departments WITH CHECK ADD CONSTRAINT CK_departments_sort_order CHECK (sort_order >= 0);
