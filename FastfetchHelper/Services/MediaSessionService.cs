using Windows.Media.Control;
using Windows.Storage.Streams;
using FastfetchHelper.Models;

namespace FastfetchHelper.Services;

public sealed class MediaSessionService
{
    private GlobalSystemMediaTransportControlsSessionManager? _manager;

    public async Task InitializeAsync()
    {
        _manager = await GlobalSystemMediaTransportControlsSessionManager.RequestAsync();
    }

    public async Task<NowPlayingSnapshot> CaptureAsync()
    {
        if (_manager == null)
            return NowPlayingSnapshot.Empty;

        var session = _manager.GetCurrentSession();
        if (session == null)
            return NowPlayingSnapshot.Empty;

        try
        {
            var mediaProps = await session.TryGetMediaPropertiesAsync();
            var playbackInfo = session.GetPlaybackInfo();
            var timeline = session.GetTimelineProperties();

            byte[]? thumbnailBytes = await ReadThumbnailBytesAsync(mediaProps.Thumbnail);

            return new NowPlayingSnapshot
            {
                IsAvailable = true,
                Title = mediaProps.Title ?? string.Empty,
                Artist = mediaProps.Artist ?? string.Empty,
                AlbumTitle = mediaProps.AlbumTitle ?? string.Empty,
                PlaybackState = playbackInfo.PlaybackStatus.ToString(),
                Position = timeline.Position,
                Duration = timeline.EndTime > timeline.StartTime
                    ? timeline.EndTime - timeline.StartTime
                    : timeline.EndTime,
                ThumbnailBytes = thumbnailBytes
            };
        }
        catch
        {
            return NowPlayingSnapshot.Empty;
        }
    }

    private static async Task<byte[]?> ReadThumbnailBytesAsync(IRandomAccessStreamReference? thumbnail)
    {
        if (thumbnail == null)
            return null;

        try
        {
            using var stream = await thumbnail.OpenReadAsync();
            if (stream == null || stream.Size == 0)
                return null;

            using var input = stream.GetInputStreamAt(0);
            using var reader = new DataReader(input);

            await reader.LoadAsync((uint)stream.Size);

            var bytes = new byte[stream.Size];
            reader.ReadBytes(bytes);

            return bytes;
        }
        catch
        {
            return null;
        }
    }
}