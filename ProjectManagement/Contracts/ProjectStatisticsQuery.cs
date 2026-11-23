using System.ComponentModel.DataAnnotations;

namespace ProjectManagement.Contracts;

public sealed class ProjectStatisticsQuery : IValidatableObject
{
    public DateOnly? StartDateFrom { get; set; }
    public DateOnly? StartDateTo { get; set; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (StartDateFrom > StartDateTo)
            yield return new ValidationResult("StartDateTo must be on or after StartDateFrom.", [nameof(StartDateTo)]);
    }
}
