using System.Diagnostics;
using System.Management;
using System.Net;
using System.Net.Sockets;
using System.Runtime.InteropServices;
using FastfetchHelper.Models;

namespace FastfetchHelper.Services;

public sealed class SystemStatsService : IDisposable
{
    private readonly PerformanceCounter _cpuCounter;
    private readonly PerformanceCounter _ramCounter;
    private readonly AudioAnalysisService _audioAnalysisService;
    private string? _cachedCpuName;
    private string? _cachedGpuName;
    private double? _cachedTotalMemoryMb;

    public SystemStatsService(AudioAnalysisService audioAnalysisService)
    {
        _audioAnalysisService = audioAnalysisService;

        _cpuCounter = new PerformanceCounter("Processor", "% Processor Time", "_Total");
        _ramCounter = new PerformanceCounter("Memory", "Available MBytes");

        _ = _cpuCounter.NextValue();
    }

    public SystemSnapshot Capture()
    {
        var now = DateTime.Now;
        var cpuUsage = Math.Round(_cpuCounter.NextValue(), 1);
        var uptime = TimeSpan.FromMilliseconds(Environment.TickCount64);
        double availableMb = _ramCounter.NextValue();
        double totalMb = GetTotalMemoryMb();
        double usedMb = totalMb - availableMb;

        double totalMemoryGb = totalMb / 1024.0;
        double usedMemoryGb = usedMb / 1024.0;
        double memoryPercent = totalMb <= 0 ? 0 : usedMb / totalMb * 100.0;

        string user = Environment.UserName;
        string machine = Environment.MachineName;

        var (screenWidth, screenHeight, refreshRate) = GetPrimaryDisplayInfo();

        return new SystemSnapshot
        {
            UserHost = $"{user}@{machine}",
            UserName = user,
            MachineName = machine,

            OsDescription = GetOsDescription(),
            KernelVersion = Environment.OSVersion.VersionString,
            Architecture = RuntimeInformation.OSArchitecture.ToString(),

            CpuName = GetCpuName(),
            GpuName = GetGpuName(),

            CpuUsagePercent = cpuUsage,

            MemoryUsedGb = usedMemoryGb,
            MemoryTotalGb = totalMemoryGb,
            MemoryUsagePercent = memoryPercent,

            ScreenWidth = screenWidth,
            ScreenHeight = screenHeight,
            RefreshRate = refreshRate,

            LocalIp = GetLocalIpAddress(),

            ProcessCount = Process.GetProcesses().Length,

            Drives = GetDriveSnapshots(),

            Uptime = uptime,
            UptimeText = $"{(int)uptime.TotalHours}h {uptime.Minutes}m {uptime.Seconds}s",
            LocalTime = now,

            Audio = _audioAnalysisService.GetSnapshot()
            
        };
    }
    private double GetTotalMemoryMb()
    {
        if (_cachedTotalMemoryMb.HasValue)
            return _cachedTotalMemoryMb.Value;

        using var searcher = new ManagementObjectSearcher(
            "SELECT TotalPhysicalMemory FROM Win32_ComputerSystem");

        foreach (var obj in searcher.Get())
        {
            double bytes = Convert.ToDouble(obj["TotalPhysicalMemory"]);
            _cachedTotalMemoryMb = bytes / 1024.0 / 1024.0;
            return _cachedTotalMemoryMb.Value;
        }

        _cachedTotalMemoryMb = 0;
        return 0;
    }

    private static double BytesToGb(ulong bytes)
    {
        return bytes / 1024d / 1024d / 1024d;
    }

    private static string GetOsDescription()
    {
        return RuntimeInformation.OSDescription.Trim();
    }
    private static (int Width, int Height, int RefreshRate) GetPrimaryDisplayInfo()
    {
        try
        {
            var screen = Screen.PrimaryScreen;
            if (screen == null)
                return (0, 0, 0);

            int width = screen.Bounds.Width;
            int height = screen.Bounds.Height;
            int refresh = GetRefreshRateFromWmi();

            return (width, height, refresh);
        }
        catch
        {
            return (0, 0, 0);
        }
    }
    private static int GetRefreshRateFromWmi()
    {
        try
        {
            using var searcher = new ManagementObjectSearcher(
                "SELECT CurrentRefreshRate FROM Win32_VideoController");

            foreach (var obj in searcher.Get())
            {
                if (obj["CurrentRefreshRate"] is uint rate && rate > 1)
                    return (int)rate;
            }
        }
        catch
        {
            // ignored
        }

        return 0;
    }
    private string GetCpuName()
    {
        if (!string.IsNullOrWhiteSpace(_cachedCpuName))
            return _cachedCpuName;

        try
        {
            using var searcher = new ManagementObjectSearcher("select Name from Win32_Processor");
            foreach (var obj in searcher.Get())
            {
                var name = obj["Name"]?.ToString()?.Trim();
                if (!string.IsNullOrWhiteSpace(name))
                {
                    _cachedCpuName = name;
                    return _cachedCpuName;
                }
            }
        }
        catch
        {
            // ignored
        }

        _cachedCpuName = "Unknown CPU";
        return _cachedCpuName;
    }
    private string GetGpuName()
    {
        if (!string.IsNullOrWhiteSpace(_cachedGpuName))
            return _cachedGpuName;

        try
        {
            using var searcher = new ManagementObjectSearcher("select Name from Win32_VideoController");
            foreach (var obj in searcher.Get())
            {
                var name = obj["Name"]?.ToString()?.Trim();
                if (!string.IsNullOrWhiteSpace(name))
                {
                    _cachedGpuName = name;
                    return _cachedGpuName;
                }
            }
        }
        catch
        {
            // ignored
        }

        _cachedGpuName = "Unknown GPU";
        return _cachedGpuName;
    }
    private static string GetLocalIpAddress()
    {
        try
        {
            var host = Dns.GetHostEntry(Dns.GetHostName());

            foreach (var ip in host.AddressList)
            {
                if (ip.AddressFamily == AddressFamily.InterNetwork &&
                    !IPAddress.IsLoopback(ip))
                {
                    return ip.ToString();
                }
            }
        }
        catch
        {
            // ignored
        }

        return "Unavailable";
    }

    private static IReadOnlyList<DriveSnapshot> GetDriveSnapshots()
    {
        var drives = new List<DriveSnapshot>();

        try
        {
            foreach (var drive in DriveInfo.GetDrives()
                         .Where(d => d.IsReady && d.DriveType == DriveType.Fixed))
            {
                double totalGb = drive.TotalSize / 1024d / 1024d / 1024d;
                double freeGb = drive.TotalFreeSpace / 1024d / 1024d / 1024d;
                double usedGb = totalGb - freeGb;
                double percent = totalGb <= 0 ? 0 : usedGb / totalGb * 100.0;

                drives.Add(new DriveSnapshot
                {
                    Name = drive.Name,
                    UsedGb = usedGb,
                    TotalGb = totalGb,
                    UsagePercent = percent
                });
            }
        }
        catch
        {
            // ignored
        }

        return drives;
    }

    public void Dispose()
    {
        _cpuCounter.Dispose();
        _ramCounter.Dispose();
    }
}