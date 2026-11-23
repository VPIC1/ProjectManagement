using ProjectManagement.Services;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using ProjectManagement.Data;
using ProjectManagement.Diagnostics;
using ProjectManagement.Routing;
using Serilog;

Log.Logger = new LoggerConfiguration().WriteTo.Console().CreateBootstrapLogger();

try
{
    var builder = WebApplication.CreateBuilder(args);

    builder.Services.AddSerilog((services, logger) => logger
        .ReadFrom.Configuration(builder.Configuration)
        .ReadFrom.Services(services)
        .Enrich.FromLogContext()
        .WriteTo.Console()
        .WriteTo.File(
            Path.Combine(builder.Environment.ContentRootPath, "Logs", "app-.log"),
            rollingInterval: RollingInterval.Day,
            retainedFileCountLimit: 30,
            fileSizeLimitBytes: 10 * 1024 * 1024,
            rollOnFileSizeLimit: true,
            shared: true,
            outputTemplate: "{Timestamp:yyyy-MM-dd HH:mm:ss.fff zzz} [{Level:u3}] [{SourceContext}] {Message:lj}{NewLine}{Exception}"));

    builder.Services.AddDbContext<ApplicationDbContext>(options =>
    {
        var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new DatabaseConfigurationException();
        }

        options.UseSqlServer(connectionString, sql => sql.EnableRetryOnFailure());
    });

    builder.Services.AddSingleton<TimeProvider>(TimeProvider.System);
    builder.Services.Configure<ProjectCodeOptions>(builder.Configuration.GetSection("ProjectCodes"));
    builder.Services.AddScoped<ProjectCodeGenerator>();

    var frontendOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
    builder.Services.AddCors(options => options.AddPolicy("Frontend", policy => policy
        .WithOrigins(frontendOrigins)
        .WithMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
        .AllowAnyHeader()
        .AllowCredentials()
        .WithExposedHeaders("Location")));

    builder.Services.AddControllers().AddJsonOptions(options =>
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter<ProjectManagement.Models.WorkStatus>(allowIntegerValues: false)));
    builder.Services.AddEndpointsApiExplorer();
    builder.Services.AddSwaggerGen();
    builder.Services.Configure<Microsoft.AspNetCore.Routing.RouteOptions>(options =>
        options.ConstraintMap["spa"] = typeof(SpaRouteConstraint));
    builder.Services.AddProblemDetails(options => options.CustomizeProblemDetails = context =>
        ApiErrorResponse.Enrich(context.ProblemDetails, context.HttpContext));
    builder.Services.AddHealthChecks().AddCheck<DatabaseHealthCheck>("sqlserver");

    var app = builder.Build();

    // IIS supplies PathBase for sub-applications; also support the same URL on Kestrel.
    var pathBase = builder.Configuration["Hosting:PathBase"];
    if (!string.IsNullOrWhiteSpace(pathBase))
        app.UsePathBase(pathBase);

    app.UseSerilogRequestLogging();
    app.UseMiddleware<ApiExceptionMiddleware>();

    if (app.Environment.IsDevelopment())
    {
        app.UseSwagger(options => options.RouteTemplate = "openapi/{documentName}.json");
    }

    app.UseHttpsRedirection();
    app.UseDefaultFiles();
    var frontendStaticFiles = new StaticFileOptions
    {
        OnPrepareResponse = context =>
        {
            if (context.File.Name.Equals("index.html", StringComparison.OrdinalIgnoreCase))
                context.Context.Response.Headers.CacheControl = "no-cache";
        }
    };
    app.UseStaticFiles(frontendStaticFiles);
    app.UseRouting();
    app.UseCors("Frontend");
    app.UseStatusCodePages(async statusContext =>
    {
        var context = statusContext.HttpContext;
        await ApiErrorResponse.WriteAsync(context, context.Response.StatusCode,
            "Request failed", "The request could not be completed.");
    });
    app.UseAuthorization();
    app.MapControllers();
    app.MapHealthChecks("/health/db", new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions
    {
        ResponseWriter = async (context, report) =>
        {
            if (report.Status == Microsoft.Extensions.Diagnostics.HealthChecks.HealthStatus.Healthy)
                await context.Response.WriteAsync("Healthy", context.RequestAborted);
            else
                await ApiErrorResponse.WriteAsync(context, 503, "Database unavailable",
                    "The database is temporarily unavailable.", "DATABASE_UNAVAILABLE");
        }
    });

    // React Router handles frontend routes, including direct links and browser refresh.
    app.MapFallbackToFile("{*path:nonfile:spa}", "index.html", frontendStaticFiles);

    Log.Information("ProjectManagement application starting");
    app.Run();
}
catch (Exception exception)
{
    Log.Fatal(exception, "Application terminated unexpectedly");
    throw;
}
finally
{
    Log.CloseAndFlush();
}

// Allows integration tests to host the application in memory.
public partial class Program { }
