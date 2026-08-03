#include "RoleDsp.h"

namespace mz
{
RoleDsp::RoleDsp() noexcept
{
    for (auto& value : inputSpectrum)
        value.store (0.0f, std::memory_order_relaxed);
    for (auto& value : currentSpectralReductionDb)
        value.store (0.0f, std::memory_order_relaxed);
}

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

void RoleDsp::Biquad::reset() noexcept
{
    z1 = 0.0f;
    z2 = 0.0f;
}

void RoleDsp::Biquad::setPeak (double sampleRate,
                               float centreHz,
                               float q,
                               float gainDb) noexcept
{
    const auto safeRate = juce::jmax (1.0, sampleRate);
    const auto frequency = juce::jlimit (20.0,
                                         safeRate * 0.42,
                                         static_cast<double> (centreHz));
    const auto safeQ = juce::jmax (0.2, static_cast<double> (q));
    const auto amplitude = std::pow (10.0, static_cast<double> (gainDb) / 40.0);
    const auto omega = juce::MathConstants<double>::twoPi * frequency / safeRate;
    const auto alpha = std::sin (omega) / (2.0 * safeQ);
    const auto cosine = std::cos (omega);

    const auto rawB0 = 1.0 + alpha * amplitude;
    const auto rawB1 = -2.0 * cosine;
    const auto rawB2 = 1.0 - alpha * amplitude;
    const auto rawA0 = 1.0 + alpha / amplitude;
    const auto rawA1 = -2.0 * cosine;
    const auto rawA2 = 1.0 - alpha / amplitude;

    b0 = static_cast<float> (rawB0 / rawA0);
    b1 = static_cast<float> (rawB1 / rawA0);
    b2 = static_cast<float> (rawB2 / rawA0);
    a1 = static_cast<float> (rawA1 / rawA0);
    a2 = static_cast<float> (rawA2 / rawA0);
}

float RoleDsp::Biquad::process (float sample) noexcept
{
    const auto output = b0 * sample + z1;
    z1 = b1 * sample - a1 * output + z2;
    z2 = b2 * sample - a2 * output;
    return output;
}

void RoleDsp::prepare (double sampleRate, int maximumBlockSize)
{
    juce::ignoreUnused (maximumBlockSize);
    currentSampleRate = juce::jmax (1.0, sampleRate);

    sideLowPass.prepare (currentSampleRate);
    for (int index = 0; index < spectralBandCount - 1; ++index)
    {
        auto& filter = analysisLowPass[static_cast<size_t> (index)];
        filter.prepare (currentSampleRate);
        filter.setCutoff (spectralAnalysisCutoffsHz[static_cast<size_t> (index)]);
    }

    for (auto& channelFilters : spectralFilters)
        for (auto& filter : channelFilters)
            filter.reset();

    gainSmoother.reset (currentSampleRate, 0.045);
    gainSmoother.setCurrentAndTargetValue (1.0f);

    for (auto& smoother : spectralReductionSmoothers)
    {
        smoother.reset (currentSampleRate, 0.080);
        smoother.setCurrentAndTargetValue (0.0f);
    }
}

void RoleDsp::reset()
{
    sideLowPass.reset();
    for (auto& filter : analysisLowPass)
        filter.reset();
    for (auto& channelFilters : spectralFilters)
        for (auto& filter : channelFilters)
            filter.reset();

    gainSmoother.setCurrentAndTargetValue (1.0f);
    for (auto& smoother : spectralReductionSmoothers)
        smoother.setCurrentAndTargetValue (0.0f);

    currentDuckDb.store (0.0f);
    for (auto& value : inputSpectrum)
        value.store (0.0f, std::memory_order_relaxed);
    for (auto& value : currentSpectralReductionDb)
        value.store (0.0f, std::memory_order_relaxed);
}

SpectralValues RoleDsp::analyse (const juce::AudioBuffer<float>& buffer) noexcept
{
    SpectralValues result {};

    if (buffer.getNumSamples() == 0 || buffer.getNumChannels() == 0)
    {
        for (auto& value : inputSpectrum)
            value.store (0.0f, std::memory_order_relaxed);
        return result;
    }

    const auto channels = juce::jmin (2, buffer.getNumChannels());
    for (int sample = 0; sample < buffer.getNumSamples(); ++sample)
    {
        float mono = 0.0f;
        for (int channel = 0; channel < channels; ++channel)
            mono += buffer.getReadPointer (channel)[sample];
        mono /= static_cast<float> (channels);

        std::array<float, spectralBandCount - 1> lowPassValues {};
        for (int index = 0; index < spectralBandCount - 1; ++index)
            lowPassValues[static_cast<size_t> (index)] =
                analysisLowPass[static_cast<size_t> (index)].process (mono);

        const std::array<float, spectralBandCount> bands
        {{
            lowPassValues[0],
            lowPassValues[1] - lowPassValues[0],
            lowPassValues[2] - lowPassValues[1],
            lowPassValues[3] - lowPassValues[2],
            mono - lowPassValues[3]
        }};

        for (int band = 0; band < spectralBandCount; ++band)
        {
            const auto value = bands[static_cast<size_t> (band)];
            result[static_cast<size_t> (band)] += value * value;
        }
    }

    const auto inverseSamples = 1.0f / static_cast<float> (buffer.getNumSamples());
    for (int band = 0; band < spectralBandCount; ++band)
    {
        auto& value = result[static_cast<size_t> (band)];
        value = std::sqrt (juce::jmax (0.0f, value * inverseSamples));
        inputSpectrum[static_cast<size_t> (band)].store (value, std::memory_order_relaxed);
    }

    return result;
}

SpectralValues RoleDsp::getInputSpectrum() const noexcept
{
    SpectralValues result {};
    for (int band = 0; band < spectralBandCount; ++band)
        result[static_cast<size_t> (band)] =
            inputSpectrum[static_cast<size_t> (band)].load (std::memory_order_relaxed);
    return result;
}

SpectralValues RoleDsp::getSpectralReductionDb() const noexcept
{
    SpectralValues result {};
    for (int band = 0; band < spectralBandCount; ++band)
        result[static_cast<size_t> (band)] =
            currentSpectralReductionDb[static_cast<size_t> (band)].load (std::memory_order_relaxed);
    return result;
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
    const auto autoAmount = autoMultiplier (settings.autoMode);
    const auto densityAmount = densityMultiplier (settings.density);
    const auto globalAmount = juce::jlimit (0.0f, 1.0f, settings.globalStrength);

    const auto spectralMaximum = 7.0f
                                 * profile.supportYield
                                 * densityAmount
                                 * autoAmount
                                 * globalAmount
                                 * juce::jlimit (0.0f, 1.0f, settings.spectralDepth);

    static constexpr std::array<float, spectralBandCount> qValues
    {{ 0.72f, 0.82f, 0.90f, 1.00f, 0.78f }};

    for (int band = 0; band < spectralBandCount; ++band)
    {
        const auto targetReduction = -juce::jlimit (
            0.0f,
            8.0f,
            spectralMaximum
                * juce::jlimit (0.0f, 1.0f,
                                settings.spectralYield[static_cast<size_t> (band)]));

        auto& smoother = spectralReductionSmoothers[static_cast<size_t> (band)];
        smoother.setTargetValue (targetReduction);
        const auto currentReduction = smoother.skip (buffer.getNumSamples());
        currentSpectralReductionDb[static_cast<size_t> (band)].store (
            currentReduction,
            std::memory_order_relaxed);

        for (int channel = 0; channel < 2; ++channel)
            spectralFilters[static_cast<size_t> (band)][static_cast<size_t> (channel)].setPeak (
                currentSampleRate,
                spectralBandCentresHz[static_cast<size_t> (band)],
                qValues[static_cast<size_t> (band)],
                currentReduction);
    }

    const auto processedChannels = juce::jmin (2, buffer.getNumChannels());
    for (int channel = 0; channel < processedChannels; ++channel)
    {
        auto* data = buffer.getWritePointer (channel);
        for (int sample = 0; sample < buffer.getNumSamples(); ++sample)
        {
            auto value = data[sample];
            for (int band = 0; band < spectralBandCount; ++band)
                value = spectralFilters[static_cast<size_t> (band)]
                                        [static_cast<size_t> (channel)].process (value);
            data[sample] = value;
        }
    }

    const auto duckDepth = 1.75f
                           * profile.supportYield
                           * densityAmount
                           * autoAmount
                           * globalAmount
                           * juce::jlimit (0.0f, 1.0f, settings.yieldRequest);
    const auto duckDb = -juce::jlimit (0.0f, 2.0f, duckDepth);
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
