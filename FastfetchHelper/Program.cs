using System.Text.Json;
using FastfetchHelper.Models;
using FastfetchHelper.Services;

var builder = WebApplication.CreateBuilder(args);

builder.WebHost.UseUrls("http://127.0.0.1:51337");

builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.WriteIndented = true;
});

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy
            .AllowAnyOrigin()
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

var app = builder.Build();
app.UseCors();
var audioService = new AudioAnalysisService();
var systemService = new SystemStatsService(audioService);
var mediaService = new MediaSessionService();

await mediaService.InitializeAsync();

SystemSnapshot latestSystem = systemService.Capture();
NowPlayingSnapshot latestMedia = NowPlayingSnapshot.Empty;

var cts = new CancellationTokenSource();

_ = Task.Run(async () =>
{
    using var timer = new PeriodicTimer(TimeSpan.FromMilliseconds(500));

    try
    {
        while (await timer.WaitForNextTickAsync(cts.Token))
        {
            try
            {
                latestSystem = systemService.Capture();
                latestMedia = await mediaService.CaptureAsync();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Snapshot update error: {ex.Message}");
            }
        }
    }
    catch (OperationCanceledException)
    {
        // normal shutdown
    }
});

app.MapGet("/", () => Results.Text("FastfetchHelper is running"));

app.MapGet("/health", () => Results.Json(new
{
    ok = true,
    service = "FastfetchHelper",
    time = DateTime.Now
}));

app.MapGet("/stats", () => Results.Json(latestSystem));

app.MapGet("/media", () => Results.Json(latestMedia));

app.Lifetime.ApplicationStopping.Register(() =>
{
    cts.Cancel();
    systemService.Dispose();
    audioService.Dispose();
});

Console.WriteLine("FastfetchHelper is running");
Console.WriteLine("Listening on http://127.0.0.1:51337");
Console.WriteLine("Endpoints:");
Console.WriteLine("  /health");
Console.WriteLine("  /stats");
Console.WriteLine("  /media");

app.Run();