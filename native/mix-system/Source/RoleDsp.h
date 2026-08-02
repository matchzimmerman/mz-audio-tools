#pragma once

#include "MixRole.h"

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
    };

    void prepare (double sampleRate, int maximumBlockSize);
    void reset();
    void process (juce::AudioBuffer<float>& buffer, const Settings& settings);

    float getCurrentDuckDb() const noexcept { return currentDuckDb.load(); }
    float getEffectiveWidth() const noexcept { return effectiveWidth.load(); }
    float getEffectiveMonoHz() const noexcept { return effectiveMonoHz.load(); }

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

    static float widthForPolicy (MixRole role, int policy) noexcept;
    static float monoHzForPolicy (MixRole role, int policy) noexcept;
    static float densityMultiplier (int densityIndex) noexcept;
    static float autoMultiplier (int autoModeIndex) noexcept;

    double currentSampleRate = 44100.0;
    OnePoleLowPass sideLowPass;
    juce::SmoothedValue<float, juce::ValueSmoothingTypes::Linear> gainSmoother;

    std::atomic<float> currentDuckDb { 0.0f };
    std::atomic<float> effectiveWidth { 1.0f };
    std::atomic<float> effectiveMonoHz { 0.0f };
};
} // namespace mz
