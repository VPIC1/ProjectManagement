using Microsoft.AspNetCore.Routing;

namespace ProjectManagement.Routing;

// Unknown API/system/static-file paths must return errors instead of React HTML.
public sealed class SpaRouteConstraint : IRouteConstraint
{
    public bool Match(HttpContext? httpContext, IRouter? route, string routeKey,
        RouteValueDictionary values, RouteDirection routeDirection)
    {
        if (httpContext is null) return false;
        var path = httpContext.Request.Path;
        return !path.StartsWithSegments("/api") && !path.StartsWithSegments("/health") &&
            !path.StartsWithSegments("/openapi") && !path.StartsWithSegments("/assets");
    }
}
