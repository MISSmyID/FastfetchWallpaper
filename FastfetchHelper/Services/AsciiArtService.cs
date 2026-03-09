// using System.IO;
// using System.Windows.Media;
// using System.Windows.Media.Imaging;
// using FastfetchHelper.Models;
//
// namespace FastfetchHelper.Services;
//
// public static class AsciiArtService
// {
//     // Тёмное -> пусто, светлое -> плотно
//     private const string Ramp = "  ..,,::--==++**##%%@@WW";
//
//     public static AsciiArtSnapshot ConvertColored(byte[] imageBytes, int targetWidth = 48)
//     {
//         using var ms = new MemoryStream(imageBytes);
//
//         var decoder = BitmapDecoder.Create(
//             ms,
//             BitmapCreateOptions.PreservePixelFormat,
//             BitmapCacheOption.OnLoad);
//
//         var source = decoder.Frames[0];
//
//         int srcWidth = source.PixelWidth;
//         int srcHeight = source.PixelHeight;
//
//         if (srcWidth <= 0 || srcHeight <= 0)
//             return new AsciiArtSnapshot();
//
//         // Сохраняем пропорции, но учитываем, что символ выше своей ширины
//         int targetHeight = Math.Max(1,
//             (int)Math.Round(srcHeight / (double)srcWidth * targetWidth * 0.52));
//
//         var scaled = new TransformedBitmap(
//             source,
//             new ScaleTransform(
//                 targetWidth / (double)srcWidth,
//                 targetHeight / (double)srcHeight));
//
//         var formatted = new FormatConvertedBitmap();
//         formatted.BeginInit();
//         formatted.Source = scaled;
//         formatted.DestinationFormat = PixelFormats.Bgra32;
//         formatted.EndInit();
//
//         int stride = formatted.PixelWidth * 4;
//         byte[] pixels = new byte[formatted.PixelHeight * stride];
//         formatted.CopyPixels(pixels, stride, 0);
//
//         var lines = new List<AsciiArtLine>(formatted.PixelHeight);
//
//         for (int y = 0; y < formatted.PixelHeight; y++)
//         {
//             var cells = new List<AsciiArtCell>(formatted.PixelWidth);
//
//             for (int x = 0; x < formatted.PixelWidth; x++)
//             {
//                 int index = y * stride + x * 4;
//
//                 byte b = pixels[index + 0];
//                 byte g = pixels[index + 1];
//                 byte r = pixels[index + 2];
//                 byte a = pixels[index + 3];
//
//                 if (a < 8)
//                 {
//                     cells.Add(new AsciiArtCell
//                     {
//                         Symbol = ' ',
//                         Foreground = Brushes.Transparent
//                     });
//                     continue;
//                 }
//
//                 // Перцептивная яркость
//                 double luminance =
//                     0.2126 * r +
//                     0.7152 * g +
//                     0.0722 * b;
//
//                 // Нормализация 0..1
//                 double l = luminance / 255.0;
//
//                 // Немного поднимаем контраст и делаем светлое плотнее
//                 l = Math.Pow(l, 0.80);          // gamma
//                 l = ((l - 0.5) * 1.30) + 0.5;  // contrast boost
//                 l = Math.Clamp(l, 0.0, 1.0);
//
//                 // Очень светлые пиксели принудительно делаем плотными
//                 char symbol;
//                 if (l > 0.96) symbol = 'W';
//                 else if (l > 0.90) symbol = '@';
//                 else if (l > 0.84) symbol = '%';
//                 else
//                 {
//                     int rampIndex = (int)Math.Round(l * (Ramp.Length - 1));
//                     rampIndex = Math.Clamp(rampIndex, 0, Ramp.Length - 1);
//                     symbol = Ramp[rampIndex];
//                 }
//
//                 var brush = new SolidColorBrush(Color.FromRgb(r, g, b));
//                 brush.Freeze();
//
//                 cells.Add(new AsciiArtCell
//                 {
//                     Symbol = symbol,
//                     Foreground = brush
//                 });
//             }
//
//             lines.Add(new AsciiArtLine { Cells = cells });
//         }
//
//         return new AsciiArtSnapshot
//         {
//             Lines = lines
//         };
//     }
// }