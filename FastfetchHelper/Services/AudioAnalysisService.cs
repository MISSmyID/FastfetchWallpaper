using FastfetchHelper.Models;
using NAudio.Dsp;
using NAudio.Wave;

namespace FastfetchHelper.Services;

public sealed class AudioAnalysisService : IDisposable
{
    private readonly WasapiLoopbackCapture _capture;
    private readonly object _sync = new();
    
    private double _smoothBass;
    private double _smoothMid;
    private double _smoothTreble;
    private double _smoothVolume;

    private volatile AudioSnapshot _latest = new();

    private readonly List<float> _sampleBuffer = new();
    private readonly int _fftLength = 1024;

    public AudioAnalysisService()
    {
        _capture = new WasapiLoopbackCapture();
        _capture.DataAvailable += OnDataAvailable;
        _capture.RecordingStopped += OnRecordingStopped;
        _capture.StartRecording();
    }

    public AudioSnapshot GetSnapshot()
    {
        return _latest;
    }

    private void OnRecordingStopped(object? sender, StoppedEventArgs e)
    {
        // Ничего критичного. Пока просто молча переживаем остановку.
    }

    private void OnDataAvailable(object? sender, WaveInEventArgs e)
    {
        try
        {
            ProcessAudioBuffer(e.Buffer, e.BytesRecorded, _capture.WaveFormat);
        }
        catch
        {
            // На MVP этапе не падаем из-за аудио.
        }
    }

    private void ProcessAudioBuffer(byte[] buffer, int bytesRecorded, WaveFormat waveFormat)
    {
        if (waveFormat.Encoding != WaveFormatEncoding.IeeeFloat)
            return;

        int bytesPerSample = waveFormat.BitsPerSample / 8;
        int channels = waveFormat.Channels;
        if (bytesPerSample != 4 || channels <= 0)
            return;

        int sampleCount = bytesRecorded / bytesPerSample;
        int frameCount = sampleCount / channels;

        lock (_sync)
        {
            for (int frame = 0; frame < frameCount; frame++)
            {
                float mono = 0f;

                for (int ch = 0; ch < channels; ch++)
                {
                    int sampleIndex = (frame * channels + ch) * bytesPerSample;
                    float sample = BitConverter.ToSingle(buffer, sampleIndex);
                    mono += sample;
                }

                mono /= channels;
                _sampleBuffer.Add(mono);
            }

            while (_sampleBuffer.Count >= _fftLength)
            {
                AnalyzeChunk(_sampleBuffer.Take(_fftLength).ToArray(), waveFormat.SampleRate);
                _sampleBuffer.RemoveRange(0, _fftLength / 2);
            }
        }
    }

    private void AnalyzeChunk(float[] samples, int sampleRate)
    {
        double rms = 0.0;
        foreach (float s in samples)
        {
            rms += s * s;
        }

        rms = Math.Sqrt(rms / samples.Length);
        double volumePct = Math.Clamp(Math.Pow(rms * 1100.0, 0.72), 0.0, 100.0);

        var fftBuffer = new Complex[_fftLength];
        for (int i = 0; i < _fftLength; i++)
        {
            float window = (float)FastFourierTransform.HammingWindow(i, _fftLength);
            float windowed = samples[i] * window;

            fftBuffer[i].X = windowed;
            fftBuffer[i].Y = 0;
        }

        int m = (int)Math.Log2(_fftLength);
        FastFourierTransform.FFT(true, m, fftBuffer);

        double bass = GetBandEnergy(fftBuffer, sampleRate, 20, 180);
        double mid = GetBandEnergy(fftBuffer, sampleRate, 180, 2200);
        double treble = GetBandEnergy(fftBuffer, sampleRate, 2200, 12000);

        double bassPct = NormalizeBand(bass, 220.0);
        double midPct = NormalizeBand(mid, 160.0);
        double treblePct = NormalizeBand(treble, 120.0);

        _smoothBass = Lerp(_smoothBass, bassPct, 0.55);
        _smoothMid = Lerp(_smoothMid, midPct, 0.50);
        _smoothTreble = Lerp(_smoothTreble, treblePct, 0.45);
        _smoothVolume = Lerp(_smoothVolume, volumePct, 0.35);

        _latest = new AudioSnapshot
        {
            BassPercent = _smoothBass,
            MidPercent = _smoothMid,
            TreblePercent = _smoothTreble,
            VolumePercent = _smoothVolume
        };
    }
    private static double Lerp(double from, double to, double t)
    {
        return from + (to - from) * t;
    }
    private double GetBandEnergy(Complex[] fftBuffer, int sampleRate, int lowHz, int highHz)
    {
        int binCount = fftBuffer.Length / 2;
        double binSize = (double)sampleRate / fftBuffer.Length;

        int lowBin = Math.Max(0, (int)(lowHz / binSize));
        int highBin = Math.Min(binCount - 1, (int)(highHz / binSize));

        if (highBin <= lowBin)
            return 0;

        double sum = 0.0;

        for (int i = lowBin; i <= highBin; i++)
        {
            double mag = Math.Sqrt(
                fftBuffer[i].X * fftBuffer[i].X +
                fftBuffer[i].Y * fftBuffer[i].Y);

            sum += mag;
        }

        return sum;
    }

    private static double NormalizeBand(double value, double gain)
    {
        double x = value * gain;

        // мягкая компрессия
        x = x / (1.0 + x);

        // в проценты
        x *= 100.0;

        // умеренное поднятие тихих значений
        x = Math.Pow(x / 100.0, 0.82) * 100.0;

        return Math.Clamp(x, 0.0, 100.0);
    }

    public void Dispose()
    {
        _capture.DataAvailable -= OnDataAvailable;
        _capture.RecordingStopped -= OnRecordingStopped;

        try
        {
            _capture.StopRecording();
        }
        catch
        {
            // ignore
        }

        _capture.Dispose();
    }
}