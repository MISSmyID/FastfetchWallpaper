namespace FastfetchHelper.Models;

public sealed class NowPlayingSnapshot
{
    public static NowPlayingSnapshot Empty { get; } = new();

    public bool IsAvailable { get; init; }

    public string Title { get; init; } = string.Empty;
    public string Artist { get; init; } = string.Empty;
    public string AlbumTitle { get; init; } = string.Empty;

    public string PlaybackState { get; init; } = string.Empty;

    public TimeSpan Position { get; init; }
    public TimeSpan Duration { get; init; }

    public byte[]? ThumbnailBytes { get; init; }
}