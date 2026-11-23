-- DBeaver-compatible: the ENTIRE seed is ONE SQL statement.
-- Select the database containing dbo.projects / dbo.tasks (not master).
-- Reopen/reload this updated file. Select ALL (Ctrl+A), then execute (Ctrl+Enter).
-- Do not select or execute an individual line inside the quoted SQL text below.
-- All DECLARE statements and their uses execute together on SQL Server.
EXEC sys.sp_executesql N'-- 20 Vietnamese sample projects, each with 10 tasks (200 tasks total).
-- Select the target database in SSMS before running this entire file.
-- Requires dbo.projects, dbo.tasks, dbo.project_code_counters, dbo.project_users.
-- All writes are transactional. Reruns recognize DEMO_PM_V1 markers and skip existing samples.
-- Does not delete or update existing project/task data; reserves codes in the shared counter.
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF OBJECT_ID(N''dbo.projects'', N''U'') IS NULL
    THROW 50001, ''Missing dbo.projects. Select the correct database.'', 1;
IF OBJECT_ID(N''dbo.tasks'', N''U'') IS NULL
    THROW 50002, ''Missing dbo.tasks. Select the correct database.'', 1;
IF OBJECT_ID(N''dbo.project_code_counters'', N''U'') IS NULL
    THROW 50003, ''Run 001_project_code_counters.sql first.'', 1;

IF OBJECT_ID(N''dbo.project_users'', N''U'') IS NULL
    THROW 50004, ''Missing dbo.project_users. Import the employee directory first.'', 1;

DECLARE @Users TABLE (rn INT PRIMARY KEY, code NVARCHAR(50), name NVARCHAR(255));
INSERT INTO @Users (rn, code, name)
SELECT CONVERT(INT, ROW_NUMBER() OVER (ORDER BY code)), code, name FROM dbo.project_users;
DECLARE @UserCount INT = (SELECT COUNT(*) FROM @Users);
IF @UserCount = 0 THROW 50005, ''The employee directory is empty.'', 1;

DECLARE @Today DATE = CONVERT(DATE, SYSUTCDATETIME() AT TIME ZONE ''UTC'' AT TIME ZONE ''SE Asia Standard Time'');
DECLARE @Period VARCHAR(4) = RIGHT(CONVERT(CHAR(4), YEAR(@Today)), 2)
    + RIGHT(''0'' + CONVERT(VARCHAR(2), MONTH(@Today)), 2);
DECLARE @Prefix NVARCHAR(7) = N''IT'' + @Period;
DECLARE @ProjectsAdded INT = 0, @TasksAdded INT = 0;

DECLARE @Projects TABLE (
    sample_no INT PRIMARY KEY,
    project_name NVARCHAR(255),
    manager NVARCHAR(255),
    requester NVARCHAR(255),
    status NVARCHAR(20),
    project_code NVARCHAR(50) NULL
);
INSERT INTO @Projects (sample_no, project_name, status)
VALUES
    (1, N''Triển khai hệ thống quản lý tài sản CNTT'', N''PENDING''),
    (2, N''Nâng cấp hệ thống Active Directory'', N''COMPLETE''),
    (3, N''Chuẩn hóa tài khoản VPN'', N''PENDING''),
    (4, N''Triển khai Microsoft 365'', N''HOLD''),
    (5, N''Nâng cấp mạng nội bộ nhà máy'', N''PENDING''),
    (6, N''Xây dựng cổng hỗ trợ IT Helpdesk'', N''COMPLETE''),
    (7, N''Triển khai sao lưu dữ liệu tập trung'', N''PENDING''),
    (8, N''Nâng cấp hệ thống camera giám sát'', N''CANCEL''),
    (9, N''Chuẩn hóa phân quyền thư mục dùng chung'', N''PENDING''),
    (10, N''Triển khai quản lý bản vá máy tính'', N''HOLD''),
    (11, N''Xây dựng báo cáo hoạt động IT'', N''PENDING''),
    (12, N''Nâng cấp máy chủ cơ sở dữ liệu'', N''COMPLETE''),
    (13, N''Triển khai giám sát hệ thống mạng'', N''PENDING''),
    (14, N''Kiểm kê thiết bị CNTT toàn công ty'', N''PENDING''),
    (15, N''Xây dựng quy trình cấp phát thiết bị'', N''COMPLETE''),
    (16, N''Triển khai chữ ký số nội bộ'', N''CANCEL''),
    (17, N''Nâng cấp hệ thống Wi-Fi văn phòng'', N''PENDING''),
    (18, N''Xây dựng phương án khôi phục sau sự cố'', N''HOLD''),
    (19, N''Triển khai đào tạo an toàn thông tin'', N''PENDING''),
    (20, N''Xây dựng cổng quản lý dự án IT'', N''PENDING'');

-- Use directory codes for assignments; requester remains the employee name.
UPDATE p SET manager = owner.code, requester = requester.name
FROM @Projects p
INNER JOIN @Users owner ON owner.rn = (p.sample_no - 1) % @UserCount + 1
INNER JOIN @Users requester ON requester.rn = (p.sample_no + 2) % @UserCount + 1;

DECLARE @TaskTemplates TABLE (task_no INT PRIMARY KEY, task_name NVARCHAR(255));
INSERT INTO @TaskTemplates (task_no, task_name)
VALUES
    (1, N''Khảo sát hiện trạng''),
    (2, N''Thu thập và xác nhận yêu cầu''),
    (3, N''Lập kế hoạch triển khai''),
    (4, N''Thiết kế giải pháp''),
    (5, N''Chuẩn bị môi trường''),
    (6, N''Triển khai cấu hình''),
    (7, N''Kiểm thử chức năng''),
    (8, N''Hoàn thiện tài liệu và đào tạo''),
    (9, N''Nghiệm thu và bàn giao''),
    (10, N''Theo dõi sau triển khai'');

BEGIN TRY
    BEGIN TRANSACTION;

    -- Uses the same monthly counter and lock hints as ProjectCodeGenerator.
    -- Locks the key range even when this month''s counter does not exist yet.
    DECLARE @LastNumber BIGINT;
    SELECT @LastNumber = last_number
    FROM dbo.project_code_counters WITH (UPDLOCK, HOLDLOCK)
    WHERE prefix = ''IT'' AND period = @Period;

    DECLARE @ExistingMax BIGINT;
    SELECT @ExistingMax = COALESCE(MAX(TRY_CONVERT(BIGINT, SUBSTRING(project_code, LEN(@Prefix) + 1, 50))), 0)
    FROM dbo.projects
    WHERE project_code LIKE @Prefix + N''%''
      AND LEN(project_code) > LEN(@Prefix)
      AND SUBSTRING(project_code, LEN(@Prefix) + 1, 50) NOT LIKE N''%[^0-9]%'';

    IF @LastNumber IS NULL
    BEGIN
        SET @LastNumber = @ExistingMax;
        INSERT INTO dbo.project_code_counters (prefix, period, last_number) VALUES (''IT'', @Period, @LastNumber);
    END;
    IF @ExistingMax > @LastNumber SET @LastNumber = @ExistingMax;

    DECLARE @SampleNo INT = 1;
    DECLARE @Marker NVARCHAR(50), @Code NVARCHAR(50), @Digits NVARCHAR(20);

    WHILE @SampleNo <= 20
    BEGIN
        SET @Marker = N''[DEMO_PM_V1:'' + RIGHT(N''00'' + CONVERT(NVARCHAR(2), @SampleNo), 2) + N'']'';
        SET @Code = NULL;

        IF (SELECT COUNT(*) FROM dbo.projects WITH (UPDLOCK, HOLDLOCK)
            WHERE LEFT(description, LEN(@Marker)) = @Marker) > 1
            THROW 50004, ''Multiple projects use the same sample marker. Resolve duplicates before rerunning.'', 1;

        SELECT @Code = project_code
        FROM dbo.projects WITH (UPDLOCK, HOLDLOCK)
        WHERE LEFT(description, LEN(@Marker)) = @Marker;

        IF @Code IS NULL
        BEGIN
            SET @LastNumber = @LastNumber + 1;
            SET @Digits = CONVERT(NVARCHAR(20), @LastNumber);
            SET @Code = @Prefix + CASE WHEN @LastNumber < 1000 THEN RIGHT(N''000'' + @Digits, 3) ELSE @Digits END;

            INSERT INTO dbo.projects (
                project_code, project_name, description, manager, requester,
                status, start_date, end_date
            )
            SELECT @Code, project_name,
                @Marker + N'' Dữ liệu mẫu để kiểm tra quản lý dự án: '' + project_name,
                manager, requester, status,
                DATEADD(DAY, CASE WHEN status IN (N''COMPLETE'', N''CANCEL'') THEN -40 ELSE -10 END, @Today),
                DATEADD(DAY, CASE WHEN status IN (N''COMPLETE'', N''CANCEL'') THEN -5 WHEN status = N''HOLD'' THEN 45 ELSE 30 END, @Today)
            FROM @Projects WHERE sample_no = @SampleNo;
            SET @ProjectsAdded += @@ROWCOUNT;
        END;

        UPDATE @Projects SET project_code = @Code WHERE sample_no = @SampleNo;
        SET @SampleNo += 1;
    END;

    UPDATE dbo.project_code_counters SET last_number = @LastNumber WHERE prefix = ''IT'' AND period = @Period;

    INSERT INTO dbo.tasks (
        project_code, task_name, description, PIC, status, start_date, end_date
    )
    SELECT p.project_code,
        RIGHT(N''00'' + CONVERT(NVARCHAR(2), t.task_no), 2) + N''. '' + t.task_name,
        marker.value + N'' '' + t.task_name + N'' cho dự án '' + p.project_name,
        actual_project.manager,
        CASE WHEN p.status = N''COMPLETE'' THEN N''COMPLETE''
             WHEN p.status = N''CANCEL'' THEN N''CANCEL''
             WHEN t.task_no <= 3 THEN N''COMPLETE''
             WHEN p.status = N''HOLD'' THEN N''HOLD''
             ELSE N''PENDING'' END,
        DATEADD(DAY, (t.task_no - 1) * 3, actual_project.start_date),
        DATEADD(DAY, (t.task_no - 1) * 3 + 2, actual_project.start_date)
    FROM @Projects AS p
    INNER JOIN dbo.projects AS actual_project ON actual_project.project_code = p.project_code
    CROSS JOIN @TaskTemplates AS t
    CROSS APPLY (SELECT N''[DEMO_PM_V1:''
        + RIGHT(N''00'' + CONVERT(NVARCHAR(2), p.sample_no), 2)
        + N'':T'' + RIGHT(N''00'' + CONVERT(NVARCHAR(2), t.task_no), 2) + N'']'' AS value) AS marker
    WHERE NOT EXISTS (
        SELECT 1 FROM dbo.tasks AS existing WITH (UPDLOCK, HOLDLOCK)
        WHERE existing.project_code = p.project_code
          AND LEFT(existing.description, LEN(marker.value)) = marker.value
    );
    SET @TasksAdded = @@ROWCOUNT;

    COMMIT TRANSACTION;

    SELECT @ProjectsAdded AS projects_added, @TasksAdded AS tasks_added,
           @Prefix AS code_prefix, @LastNumber AS last_sequence_number;

    SELECT p.project_code, actual_project.project_name, actual_project.status, COUNT(t.id) AS total_tasks
    FROM @Projects AS p
    INNER JOIN dbo.projects AS actual_project ON actual_project.project_code = p.project_code
    LEFT JOIN dbo.tasks AS t ON t.project_code = p.project_code
    GROUP BY p.sample_no, p.project_code, actual_project.project_name, actual_project.status
    ORDER BY p.sample_no;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
';
