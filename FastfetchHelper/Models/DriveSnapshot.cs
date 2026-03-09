namespace FastfetchHelper.Models;

public sealed class DriveSnapshot
{
    public string Name { get; init; } = string.Empty;
    public double UsedGb { get; init; }
    public double TotalGb { get; init; }
    public double UsagePercent { get; init; }
}