#pragma once

#include <JuceHeader.h>

#include <array>
#include <atomic>
#include <cstdint>

namespace mz
{
class GenerativeEngine final
{
public:
    static constexpr int numStreams = 6;

    struct Settings
    {
        float density = 0.55f;
        float entropy = 0.45f;
        float energy = 0.55f;
        float motion = 0.45f;
        float spread = 0.75f;
        float selfMix = 0.75f;
        float space = 0.28f;
        float outputDb = -3.0f;
        int root = 0;
        int mode = 0;
        bool running = true;
    };

    struct Telemetry
    {
        std::array<float, numStreams> levels {};
        std::array<float, numStreams> pans {};
        std::array<float, numStreams> duckDb {};
        float pressure = 0.0f;
        float adaptiveDensity = 0.0f;
        float outputRms = 0.0f;
        double bpm = 96.0;
        bool running = false;
    };

    GenerativeEngine();

    void prepare (double newSampleRate, int maximumBlockSize);
    void reset (std::uint32_t seed = 0x4d5a434dU);
    void requestMutation() noexcept { mutationRequested.store (true, std::memory_order_release); }

    void process (juce::AudioBuffer<float>& output, const Settings& settings, double bpm);

    Telemetry getTelemetry() const noexcept;
    static const char* streamName (int index) noexcept;

private:
    enum class Kind
    {
        foundation,
        body,
        pulse,
        focus,
        grain,
        air
    };

    struct Stream
    {
        Kind kind = Kind::body;
        std::uint32_t rng = 1U;
        double phase1 = 0.0;
        double phase2 = 0.0;
        double lfoPhase = 0.0;
        double samplesUntilEvent = 0.0;
        float envelope = 0.0f;
        float envelopeDecay = 0.999f;
        float eventAmplitude = 0.0f;
        float frequency = 220.0f;
        float targetFrequency = 220.0f;
        float pan = 0.0f;
        float panTarget = 0.0f;
        float lastEffectivePan = 0.0f;
        float levelEnvelope = 0.0f;
        float duckGain = 1.0f;
        float airLowpass = 0.0f;
    };

    void beginScene (const Settings& settings, double bpm);
    void triggerEvent (int streamIndex,
                       const Settings& settings,
                       double bpm,
                       float effectiveDensity);
    void retargetPan (int streamIndex, const Settings& settings);

    float renderStream (Stream& stream, int streamIndex, const Settings& settings) noexcept;
    int chooseMidiNote (int streamIndex, const Settings& settings) noexcept;

    static std::uint32_t nextRandom (std::uint32_t& state) noexcept;
    static float random01 (std::uint32_t& state) noexcept;
    static float randomBipolar (std::uint32_t& state) noexcept;
    static float midiToHz (int midiNote) noexcept;
    static float scaleDegreeFor (int mode, int degreeIndex) noexcept;
    static int scaleLengthFor (int mode) noexcept;
    static void advancePhase (double& phase, double frequency, double sampleRate) noexcept;

    double sampleRate = 44100.0;
    std::uint32_t fieldRng = 0x4d5a434dU;
    std::array<Stream, numStreams> streams {};
    std::array<float, numStreams> sceneGain {};
    std::array<float, numStreams> sceneGainTarget {};

    double samplesUntilScene = 0.0;
    float sceneDensity = 1.0f;
    float sceneDensityTarget = 1.0f;
    float smoothedPressure = 0.0f;
    float lastAdaptiveDensity = 0.0f;

    float levelAttackCoefficient = 0.0f;
    float levelReleaseCoefficient = 0.0f;
    float duckAttackCoefficient = 0.0f;
    float duckReleaseCoefficient = 0.0f;
    float pressureCoefficient = 0.0f;
    float airFilterCoefficient = 0.0f;

    juce::Reverb reverb;
    std::atomic<bool> mutationRequested { false };

    std::array<std::atomic<float>, numStreams> telemetryLevels {};
    std::array<std::atomic<float>, numStreams> telemetryPans {};
    std::array<std::atomic<float>, numStreams> telemetryDuckDb {};
    std::atomic<float> telemetryPressure { 0.0f };
    std::atomic<float> telemetryAdaptiveDensity { 0.0f };
    std::atomic<float> telemetryOutputRms { 0.0f };
    std::atomic<double> telemetryBpm { 96.0 };
    std::atomic<bool> telemetryRunning { false };
};
} // namespace mz
