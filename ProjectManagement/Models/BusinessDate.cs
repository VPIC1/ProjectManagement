namespace ProjectManagement.Models;

/// <summary>Ngày nghiệp vụ theo giờ Việt Nam, độc lập múi giờ máy chủ.</summary>
public static class BusinessDate
{
    // Dùng TimeProvider để cùng một quy tắc hoạt động cả khi chạy thật và kiểm thử.
    public static DateOnly Today(TimeProvider clock) =>
        DateOnly.FromDateTime(clock.GetUtcNow().ToOffset(TimeSpan.FromHours(7)).DateTime);
}
