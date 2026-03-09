
namespace FastfetchHelper.Models;

public sealed class AsciiArtSnapshot
{
    public IReadOnlyList<AsciiArtLine> Lines { get; init; } = Array.Empty<AsciiArtLine>();
}

public sealed class AsciiArtLine
{
    public IReadOnlyList<AsciiArtCell> Cells { get; init; } = Array.Empty<AsciiArtCell>();
}

public sealed class AsciiArtCell
{
    public char Symbol { get; init; }
    public Brush Foreground { get; init; } = Brushes.White;
}