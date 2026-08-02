#include "RoleDsp.h"

namespace mz
{
void RoleDsp::OnePoleLowPass::prepare (double newSampleRate) noexcept
{
    sampleRate = juce::jmax (1.0, newSampleRate);
    reset();
}

void RoleDsp::OnePoleLowPass::reset() noexcept
{
    state = 0.0f;
}

void RoleDsp::OnePoleLowPass::setCutoff (float cutoffHz) noexcept
{
    if (cutoffHz <= 0.0f)
    {
        coefficient = 0.0f;
        return;
    }

    const auto bounded = juce::jlimit (5.0, sampleRate * 0.45, static_cast<double> (cutoffHz));
    coefficient = static_cast<float> (1.0 - std::exp (-juce::MathConstants<double>::twoPi
                                                       * bounded / sampleRate));
}

float RoleDsp::OnePoleLowPass::process (float sample) noexcept
{
    state += coefficient * (sample - state);
    return state;
}

void RoleDsp::prepare (double sampleRate, int maximumBlockSize)
{
    juce::ignoreUnused (maximumBlockSize);
    currentSampleRate = juce::jmax (1.0, sampleRate);
    sideLowPass.prepare (currentSampleRate);
    gainSmoother.reset (currentSampleRate, 0.045);
    gainSmoother.setCurrentAndTargetValue (1.0f);
}

void RoleDsp::reset()
{
    sideLowPass.reset();
    gainSmoother.setCurrentAndTargetValue (1.0f);
    currentDuckDb.store (0.0f);
}

float RoleDsp::widthForPolicy (MixRole role, int policy) noexcept
{
    switch (juce::jlimit (0, 3, policy))
    {
        case 1:  return 0.70f;
        case 2:  return 1.00f;
        case 3:  return 1.35f;
        default: return getRoleProfile (role).automaticWidth;
    }
}

float RoleDsp::monoHzForPolicy (MixRole role, int policy) noexcept
{
    switch (juce::jlimit (0, 6, policy))
    {
        case 1:  return 0.0f;
        case 2:  return 60.0f;
        case 3:  return 90.0f;
        case 4:  return 120.0f;
        case 5:  return 150.0f;
        case 6:  return 200.0f;
        default: return getRoleProfile (role).automaticMonoHz;
    }
}

float RoleDsp::densityMultiplier (int densityIndex) noexcept
{
    switch (juce::jlimit (0, 2, densityIndex))
    {
        case 0:  return 0.72f;
        case 2:  return 1.18f;
        default: return 1.0f;
    }
}

float RoleDsp::autoMultiplier (int autoModeIndex) noexcept
{
    switch (juce::jlimit (0, 2, autoModeIndex))
    {
        case 0:  return 0.0f;
        case 1:  return 0.48f;
        default: return 1.0f;
    }
}

void RoleDsp::process (juce::AudioBuffer<float>& buffer, const Settings& settings)
{
    if (buffer.getNumSamples() == 0 || buffer.getNumChannels() == 0)
        return;

    const auto& profile = getRoleProfile (settings.role);
    const auto width = widthForPolicy (settings.role, settings.widthPolicy);
    const auto monoHz = monoHzForPolicy (settings.role, settings.monoPolicy);
    const auto lowSideGain = settings.monoPolicy == 0 ? profile.lowSideGain : 0.0f;

    const auto duckDepth = 5.5f
                           * profile.supportYield
                           * densityMultiplier (settings.density)
                           * autoMultiplier (settings.autoMode)
                           * juce::jlimit (0.0f, 1.0f, settings.globalStrength)
                           * juce::jlimit (0.0f, 1.0f, settings.yieldRequest);
    const auto duckDb = -juce::jlimit (0.0f, 6.0f, duckDepth);
    const auto targetGain = juce::Decibels::decibelsToGain (duckDb + settings.outputTrimDb);

    currentDuckDb.store (duckDb, std::memory_order_relaxed);
    effectiveWidth.store (width, std::memory_order_relaxed);
    effectiveMonoHz.store (monoHz, std::memory_order_relaxed);
    gainSmoother.setTargetValue (targetGain);

    if (buffer.getNumChannels() < 2)
    {
        auto* mono = buffer.getWritePointer (0);
        for (int sample = 0; sample < buffer.getNumSamples(); ++sample)
            mono[sample] *= gainSmoother.getNextValue();
        return;
    }

    auto* left = buffer.getWritePointer (0);
    auto* right = buffer.getWritePointer (1);
    sideLowPass.setCutoff (monoHz);

    for (int sample = 0; sample < buffer.getNumSamples(); ++sample)
    {
        const auto mid = 0.5f * (left[sample] + right[sample]);
        const auto side = 0.5f * (left[sample] - right[sample]);

        float shapedSide = side * width;
        if (monoHz > 0.0f)
        {
            const auto lowSide = sideLowPass.process (side);
            const auto highSide = side - lowSide;
            shapedSide = width * (highSide + lowSide * lowSideGain);
        }

        const auto gain = gainSmoother.getNextValue();
        left[sample] = (mid + shapedSide) * gain;
        right[sample] = (mid - shapedSide) * gain;
    }

    for (int channel = 2; channel < buffer.getNumChannels(); ++channel)
        buffer.clear (channel, 0, buffer.getNumSamples());
}
} // namespace mz
