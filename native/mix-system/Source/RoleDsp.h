#pragma once

#include "MixRole.h"
#include "SpectralBands.h"

namespace mz
{
class RoleDsp
{
public:
    struct Settings
    {
        MixRole role = MixRole::body;
        int autoMode = 1;
        int widthPolicy = 0;
        int monoPolicy = 0;
        int density = 1;
        float outputTrimDb = 0.0f;
        float yieldRequest = 0.0f;
        float globalStrength = 0.65f;
        float spectralDepth = 0.70f;
        SpectralValues spectralYield {};
    };

    RoleDsp() noexcept;

    void prepare (double sampleRate, int maximumBlockSize);
    void reset();
    SpectralValues analyse (const juce::AudioBuffer<float>& buffer) noexcept;
    void process (juce::AudioBuffer<float>& buffer, const Settings& settings);

    float getCurrentDuckDb() const noexcept { return currentDuckDb.load(); }
    float getEffectiveWidth() const noexcept { return effectiveWidth.load(); }
    float getEffectiveMonoHz() const noexcept { return effectiveMonoHz.load(); }
    SpectralValues getInputSpectrum() const noexcept;
    SpectralValues getSpectralReductionDb() const noexcept;

private:
    class OnePoleLowPass
    {
    public:
        void prepare (double newSampleRate) noexcept;
        void reset() noexcept;
        void setCutoff (float cutoffHz) noexcept;
        float process (float sample) noexcept;

    private:
        double sampleRate = 44100.0;
        float coefficient = 0.0f;
        float state = 0.0f;
    };

    class Biquad
    {
    public:
        void reset() noexcept;
        void setPeak (double sampleRate,
                      float centreHz,
                      float q,
                      float gainDb) noexcept;
        float process (float sample) noexcept;

    private:
        float b0 = 1.0f;
        float b1 = 0.0f;
        float b2 = 0.0f;
        float a1 = 0.0f;
        float a2 = 0.0f;
        float z1 = 0.0f;
        float z2 = 0.0f;
    };

    static float widthForPolicy (MixRole role, int policy) noexcept;
    static float monoHzForPolicy (MixRole role, int policy) noexcept;
    static float densityMultiplier (int densityIndex) noexcept;
    static float autoMultiplier (int autoModeIndex) noexcept;

    double currentSampleRate = 44100.0;
    OnePoleLowPass sideLowPass;
    std::array<OnePoleLowPass, spectralBandCount - 1> analysisLowPass;
    std::array<std::array<Biquad, 2>, spectralBandCount> spectralFilters;
    juce::SmoothedValue<float, juce::ValueSmoothingTypes::Linear> gainSmoother;
    std::array<juce::SmoothedValue<float, juce::ValueSmoothingTypes::Linear>,
               spectralBandCount> spectralReductionSmoothers;

    std::atomic<float> currentDuckDb { 0.0f };
    std::atomic<float> effectiveWidth { 1.0f };
    std::atomic<float> effectiveMonoHz { 0.0f };
    std::array<std::atomic<float>, spectralBandCount> inputSpectrum;
    std::array<std::atomic<float>, spectralBandCount> currentSpectralReductionDb;
};
} // namespace mz
