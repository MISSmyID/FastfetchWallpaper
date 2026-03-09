namespace FastfetchHelper.Models;

public sealed class SystemSnapshot
{
    public string UserHost { get; init; } = string.Empty;
    public string UserName { get; init; } = string.Empty;
    public string MachineName { get; init; } = string.Empty;

    public string OsDescription { get; init; } = string.Empty;
    public string KernelVersion { get; init; } = string.Empty;
    public string Architecture { get; init; } = string.Empty;

    public string CpuName { get; init; } = string.Empty;
    public string GpuName { get; init; } = string.Empty;

    public double CpuUsagePercent { get; init; }

    public double MemoryUsedGb { get; init; }
    public double MemoryTotalGb { get; init; }
    public double MemoryUsagePercent { get; init; }

    public int ScreenWidth { get; init; }
    public int ScreenHeight { get; init; }
    public int RefreshRate { get; init; }

    public string LocalIp { get; init; } = string.Empty;

    public int ProcessCount { get; init; }

    public IReadOnlyList<DriveSnapshot> Drives { get; init; } = Array.Empty<DriveSnapshot>();

    public TimeSpan Uptime { get; init; }
    public DateTime LocalTime { get; init; }

    public AudioSnapshot Audio { get; init; } = new();
    public string UptimeText { get; init; } = string.Empty;
}