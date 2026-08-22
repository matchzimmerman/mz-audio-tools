#include "GenerativeEngine.h"

#include <algorithm>
#include <cmath>

namespace mz
{
namespace
{
constexpr float overlap[GenerativeEngine::numStreams][GenerativeEngine::numStreams] = {
    { 0.00f, 0.62f, 0.95f, 0.18f, 0.05f, 0.00f },
    { 0.62f, 0.00f, 0.54f, 0.82f, 0.42f, 0.10f },
    { 0.95f, 0.54f, 0.00f, 0.44f, 0.24f, 0.05f },
    { 0.18f, 0.82f, 0.44f, 0.00f, 0.72f, 0.34f },
    { 0.05f, 0.42f, 0.24f, 0.72f, 0.00f, 0.78f },
    { 0.00f, 0.10f, 0.05f, 0.34f, 0.78f, 0.00f }
};

constexpr float priority[GenerativeEngine::numStreams] = {
    0.90f, 0.78f, 1.20f, 1.05f, 0.82f, 0.58f
};

constexpr float duckability[GenerativeEngine::numStreams] = {
    0.92f, 0.78f, 0.34f, 0.48f, 0.62f, 0.76f
};

constexpr float baseAmplitude[GenerativeEngine::numStreams] = {
    0.22f, 0.16f, 0.20f, 0.13f, 0.105f, 0.085f
};

constexpr float baseIntervalBeats[GenerativeEngine::numStreams] = {
    4.0f, 2.0f, 0.50f, 1.25f, 0.25f, 5.0f
};

constexpr float widthLimit[GenerativeEngine::numStreams] = {
    0.12f, 0.60f, 0.38f, 0.86f, 1.00f, 1.00f
};

constexpr float laneBias[GenerativeEngine::numStreams] = {
    0.0f, -0.30f, 0.22f, 0.52f, -0.66f, 0.78f
};

constexpr double twoPi = juce::MathConstants<double>::twoPi;
constexpr double quarterPi = juce::MathConstants<double>::pi * 0.25;

float coefficientForSeconds (double sampleRate, double seconds) noexcept
{
    return static_cast<float> (std::exp (-1.0 / juce::jmax (1.0, sampleRate * seconds)));
}
} // namespace

GenerativeEngine::GenerativeEngine()
{
    streams[0].kind = Kind::foundation;
    streams[1].kind = Kind::body;
    streams[2].kind = Kind::pulse;
    streams[3].kind = Kind::focus;
    streams[4].kind = Kind::grain;
    streams[5].kind = Kind::air;

    reset();
}

void GenerativeEngine::prepare (double newSampleRate, int maximumBlockSize)
{
    juce::ignoreUnused (maximumBlockSize);
    sampleRate = juce::jmax (8000.0, newSampleRate);

    levelAttackCoefficient = coefficientForSeconds (sampleRate, 0.006);
    levelReleaseCoefficient = coefficientForSeconds (sampleRate, 0.160);
    duckAttackCoefficient = coefficientForSeconds (sampleRate, 0.010);
    duckReleaseCoefficient = coefficientForSeconds (sampleRate, 0.220);
    pressureCoefficient = coefficientForSeconds (sampleRate, 0.110);
    airFilterCoefficient = static_cast<float> (
        1.0 - std::exp (-twoPi * 1800.0 / sampleRate));

    reverb.setSampleRate (sampleRate);
    reset (fieldRng);
}

void GenerativeEngine::reset (std::uint32_t seed)
{
    if (seed == 0U)
        seed = 0x4d5a434dU;

    fieldRng = seed;
    reverb.reset();
    samplesUntilScene = 0.0;
    sceneDensity = 1.0f;
    sceneDensityTarget = 1.0f;
    smoothedPressure = 0.0f;
    lastAdaptiveDensity = 0.0f;

    for (int i = 0; i < numStreams; ++i)
    {
        auto& stream = streams[static_cast<std::size_t> (i)];
        stream.rng = seed ^ (0x9e3779b9U * static_cast<std::uint32_t> (i + 1));
        if (stream.rng == 0U)
            stream.rng = static_cast<std::uint32_t> (i + 1);

        stream.phase1 = random01 (stream.rng) * twoPi;
        stream.phase2 = random01 (stream.rng) * twoPi;
        stream.lfoPhase = random01 (stream.rng) * twoPi;
        stream.samplesUntilEvent = 0.0;
        stream.envelope = 0.0f;
        stream.envelopeDecay = 0.999f;
        stream.eventAmplitude = 0.0f;
        stream.frequency = 110.0f;
        stream.targetFrequency = 110.0f;
        stream.pan = 0.0f;
        stream.panTarget = 0.0f;
        stream.lastEffectivePan = 0.0f;
        stream.levelEnvelope = 0.0f;
        stream.duckGain = 1.0f;
        stream.airLowpass = 0.0f;

        sceneGain[static_cast<std::size_t> (i)] = 0.8f;
        sceneGainTarget[static_cast<std::size_t> (i)] = 0.8f;
        telemetryLevels[static_cast<std::size_t> (i)].store (0.0f, std::memory_order_relaxed);
        telemetryPans[static_cast<std::size_t> (i)].store (0.0f, std::memory_order_relaxed);
        telemetryDuckDb[static_cast<std::size_t> (i)].store (0.0f, std::memory_order_relaxed);
    }

    telemetryPressure.store (0.0f, std::memory_order_relaxed);
    telemetryAdaptiveDensity.store (0.0f, std::memory_order_relaxed);
    telemetryOutputRms.store (0.0f, std::memory_order_relaxed);
    telemetryRunning.store (false, std::memory_order_relaxed);
}

void GenerativeEngine::process (juce::AudioBuffer<float>& output,
                                const Settings& settings,
                                double bpm)
{
    juce::ScopedNoDenormals noDenormals;

    output.clear();
    bpm = juce::jlimit (20.0, 320.0, bpm);
    telemetryBpm.store (bpm, std::memory_order_relaxed);
    telemetryRunning.store (settings.running, std::memory_order_relaxed);

    if (! settings.running || output.getNumSamples() == 0 || output.getNumChannels() < 2)
    {
        for (int i = 0; i < numStreams; ++i)
        {
            telemetryLevels[static_cast<std::size_t> (i)].store (0.0f, std::memory_order_relaxed);
            telemetryDuckDb[static_cast<std::size_t> (i)].store (0.0f, std::memory_order_relaxed);
        }

        telemetryPressure.store (0.0f, std::memory_order_relaxed);
        telemetryAdaptiveDensity.store (0.0f, std::memory_order_relaxed);
        telemetryOutputRms.store (0.0f, std::memory_order_relaxed);
        return;
    }

    const auto mutation = mutationRequested.exchange (false, std::memory_order_acq_rel);
    if (mutation)
    {
        const auto mutationSalt = nextRandom (fieldRng);
        fieldRng ^= mutationSalt + 0x7f4a7c15U;
        if (fieldRng == 0U)
            fieldRng = 0x4d5a434dU;

        for (int i = 0; i < numStreams; ++i)
        {
            auto& stream = streams[static_cast<std::size_t> (i)];
            stream.rng ^= nextRandom (fieldRng) + static_cast<std::uint32_t> (i * 7919 + 17);
            if (stream.rng == 0U)
                stream.rng = static_cast<std::uint32_t> (i + 1);

            stream.samplesUntilEvent = juce::jmin (
                stream.samplesUntilEvent,
                sampleRate * 60.0 / bpm * (0.08 + 0.35 * random01 (stream.rng)));
            retargetPan (i, settings);
        }
        samplesUntilScene = 0.0;
    }

    if (samplesUntilScene <= 0.0)
        beginScene (settings, bpm);

    auto* left = output.getWritePointer (0);
    auto* right = output.getWritePointer (1);
    const auto numSamples = output.getNumSamples();

    const auto motion = juce::jlimit (0.0f, 1.0f, settings.motion);
    const auto sceneCoefficient = 1.0f - coefficientForSeconds (
        sampleRate, 1.2 + 4.0 * (1.0 - static_cast<double> (motion)));
    const auto panCoefficient = 1.0f - coefficientForSeconds (
        sampleRate, 0.28 + 3.0 * (1.0 - static_cast<double> (motion)));

    for (int sample = 0; sample < numSamples; ++sample)
    {
        samplesUntilScene -= 1.0;
        if (samplesUntilScene <= 0.0)
            beginScene (settings, bpm);

        sceneDensity += (sceneDensityTarget - sceneDensity) * sceneCoefficient;
        for (int i = 0; i < numStreams; ++i)
            sceneGain[static_cast<std::size_t> (i)] +=
                (sceneGainTarget[static_cast<std::size_t> (i)]
                 - sceneGain[static_cast<std::size_t> (i)]) * sceneCoefficient;

        const auto pressureNormalised = juce::jlimit (0.0f, 1.0f, smoothedPressure / 0.62f);
        const auto thinning = 1.0f - juce::jlimit (0.0f, 0.62f,
                                                   settings.selfMix * pressureNormalised * 0.62f);
        const auto effectiveDensity = juce::jlimit (
            0.025f, 1.0f, settings.density * sceneDensity * thinning);
        lastAdaptiveDensity = effectiveDensity;

        std::array<float, numStreams> raw {};

        for (int i = 0; i < numStreams; ++i)
        {
            auto& stream = streams[static_cast<std::size_t> (i)];
            stream.samplesUntilEvent -= 1.0;
            if (stream.samplesUntilEvent <= 0.0)
                triggerEvent (i, settings, bpm, effectiveDensity);

            stream.pan += (stream.panTarget - stream.pan) * panCoefficient;
            raw[static_cast<std::size_t> (i)] =
                renderStream (stream, i, settings) * sceneGain[static_cast<std::size_t> (i)];

            const auto magnitude = std::abs (raw[static_cast<std::size_t> (i)]);
            const auto coefficient = magnitude > stream.levelEnvelope
                                         ? levelAttackCoefficient
                                         : levelReleaseCoefficient;
            stream.levelEnvelope = magnitude + coefficient * (stream.levelEnvelope - magnitude);
        }

        float instantaneousPressure = 0.0f;
        for (const auto& stream : streams)
            instantaneousPressure += stream.levelEnvelope;

        smoothedPressure = instantaneousPressure
                           + pressureCoefficient * (smoothedPressure - instantaneousPressure);

        float mixLeft = 0.0f;
        float mixRight = 0.0f;

        for (int i = 0; i < numStreams; ++i)
        {
            auto& stream = streams[static_cast<std::size_t> (i)];
            float competingPressure = 0.0f;

            for (int j = 0; j < numStreams; ++j)
            {
                if (i == j)
                    continue;

                competingPressure += overlap[i][j]
                                     * streams[static_cast<std::size_t> (j)].levelEnvelope
                                     * priority[j];
            }

            const auto targetDuck = 1.0f
                                    / (1.0f + settings.selfMix
                                                   * duckability[i]
                                                   * competingPressure
                                                   * 8.0f);
            const auto duckCoefficient = targetDuck < stream.duckGain
                                             ? duckAttackCoefficient
                                             : duckReleaseCoefficient;
            stream.duckGain = targetDuck + duckCoefficient * (stream.duckGain - targetDuck);

            const auto lfoRateHz = (0.006 + 0.010 * static_cast<double> (i + 1))
                                   * (0.20 + 1.8 * static_cast<double> (motion));
            stream.lfoPhase += twoPi * lfoRateHz / sampleRate;
            if (stream.lfoPhase >= twoPi)
                stream.lfoPhase -= twoPi;

            const auto maxPan = widthLimit[i] * juce::jlimit (0.0f, 1.0f, settings.spread);
            const auto driftDepth = maxPan * (0.03f + 0.25f * motion);
            const auto effectivePan = juce::jlimit (
                -1.0f, 1.0f,
                stream.pan + static_cast<float> (std::sin (stream.lfoPhase)) * driftDepth);
            stream.lastEffectivePan = effectivePan;

            const auto angle = static_cast<double> (effectivePan + 1.0f) * quarterPi;
            const auto leftGain = static_cast<float> (std::cos (angle));
            const auto rightGain = static_cast<float> (std::sin (angle));
            const auto value = raw[static_cast<std::size_t> (i)] * stream.duckGain;

            mixLeft += value * leftGain;
            mixRight += value * rightGain;
        }

        const auto headroom = 1.0f
                              / (1.0f + settings.selfMix
                                           * juce::jmax (0.0f, smoothedPressure - 0.32f)
                                           * 0.72f);
        left[sample] = mixLeft * headroom;
        right[sample] = mixRight * headroom;
    }

    juce::Reverb::Parameters reverbParameters;
    const auto space = juce::jlimit (0.0f, 1.0f, settings.space);
    reverbParameters.roomSize = 0.24f + 0.63f * space;
    reverbParameters.damping = 0.62f - 0.32f * space;
    reverbParameters.wetLevel = 0.02f + 0.30f * space;
    reverbParameters.dryLevel = 1.0f;
    reverbParameters.width = 0.65f + 0.35f * juce::jlimit (0.0f, 1.0f, settings.spread);
    reverbParameters.freezeMode = 0.0f;
    reverb.setParameters (reverbParameters);
    reverb.processStereo (left, right, numSamples);

    const auto outputGain = juce::Decibels::decibelsToGain (settings.outputDb);
    constexpr float saturationDrive = 1.12f;
    const auto saturationNormaliser = 1.0f / std::tanh (saturationDrive);

    double outputSquares = 0.0;
    for (int sample = 0; sample < numSamples; ++sample)
    {
        left[sample] = std::tanh (left[sample] * outputGain * saturationDrive)
                       * saturationNormaliser;
        right[sample] = std::tanh (right[sample] * outputGain * saturationDrive)
                        * saturationNormaliser;

        outputSquares += static_cast<double> (left[sample]) * left[sample]
                         + static_cast<double> (right[sample]) * right[sample];
    }

    const auto outputRms = static_cast<float> (
        std::sqrt (outputSquares / juce::jmax (1, numSamples * 2)));

    for (int i = 0; i < numStreams; ++i)
    {
        const auto& stream = streams[static_cast<std::size_t> (i)];
        telemetryLevels[static_cast<std::size_t> (i)].store (
            stream.levelEnvelope, std::memory_order_relaxed);
        telemetryPans[static_cast<std::size_t> (i)].store (
            stream.lastEffectivePan, std::memory_order_relaxed);
        telemetryDuckDb[static_cast<std::size_t> (i)].store (
            juce::Decibels::gainToDecibels (stream.duckGain, -60.0f),
            std::memory_order_relaxed);
    }

    telemetryPressure.store (smoothedPressure, std::memory_order_relaxed);
    telemetryAdaptiveDensity.store (lastAdaptiveDensity, std::memory_order_relaxed);
    telemetryOutputRms.store (outputRms, std::memory_order_relaxed);
}

void GenerativeEngine::beginScene (const Settings& settings, double bpm)
{
    const auto density = juce::jlimit (0.0f, 1.0f, settings.density);
    const auto entropy = juce::jlimit (0.0f, 1.0f, settings.entropy);

    sceneDensityTarget = juce::jlimit (
        0.38f, 1.28f,
        0.62f + 0.54f * density + randomBipolar (fieldRng) * entropy * 0.30f);

    for (int i = 0; i < numStreams; ++i)
    {
        const auto chanceToRecede = (1.0f - density) * 0.45f + entropy * 0.10f;
        const auto recedes = random01 (fieldRng) < chanceToRecede;
        auto target = recedes
                          ? 0.10f + random01 (fieldRng) * 0.20f
                          : 0.42f + random01 (fieldRng) * 0.58f;

        if (i == 0)
            target = juce::jmax (0.24f, target);

        sceneGainTarget[static_cast<std::size_t> (i)] = target;
    }

    const auto focalIndex = static_cast<int> (nextRandom (fieldRng) % numStreams);
    sceneGainTarget[static_cast<std::size_t> (focalIndex)] = 1.08f + 0.16f * entropy;

    const auto minSceneBeats = 8.0 + 10.0 * (1.0 - static_cast<double> (entropy));
    const auto extraSceneBeats = 8.0 + 18.0 * random01 (fieldRng);
    const auto durationBeats = minSceneBeats + extraSceneBeats;
    samplesUntilScene = sampleRate * 60.0 / bpm * durationBeats;
}

void GenerativeEngine::triggerEvent (int streamIndex,
                                     const Settings& settings,
                                     double bpm,
                                     float effectiveDensity)
{
    auto& stream = streams[static_cast<std::size_t> (streamIndex)];
    const auto entropy = juce::jlimit (0.0f, 1.0f, settings.entropy);
    const auto energy = juce::jlimit (0.0f, 1.0f, settings.energy);

    if (stream.kind != Kind::air)
        stream.targetFrequency = midiToHz (chooseMidiNote (streamIndex, settings));

    const auto randomLevel = 0.72f + 0.46f * random01 (stream.rng);
    stream.eventAmplitude = baseAmplitude[streamIndex]
                            * (0.42f + 0.90f * energy)
                            * randomLevel;
    stream.envelope = 1.0f;

    float decaySeconds = 1.0f;
    switch (stream.kind)
    {
        case Kind::foundation: decaySeconds = 4.5f + 7.5f * energy; break;
        case Kind::body:       decaySeconds = 1.8f + 4.8f * energy; break;
        case Kind::pulse:      decaySeconds = 0.12f + 0.42f * energy; break;
        case Kind::focus:      decaySeconds = 0.48f + 2.7f * energy; break;
        case Kind::grain:      decaySeconds = 0.055f + 0.46f * energy; break;
        case Kind::air:        decaySeconds = 2.2f + 6.8f * energy; break;
    }

    decaySeconds *= 0.82f + 0.38f * random01 (stream.rng);
    stream.envelopeDecay = static_cast<float> (
        std::exp (std::log (0.001) / juce::jmax (1.0, sampleRate * decaySeconds)));

    if (stream.kind == Kind::pulse)
    {
        stream.phase1 = 0.0;
        stream.phase2 = 0.0;
    }
    else if (stream.kind == Kind::grain || stream.kind == Kind::focus)
    {
        stream.phase1 = random01 (stream.rng) * twoPi;
        stream.phase2 = random01 (stream.rng) * twoPi;
    }

    retargetPan (streamIndex, settings);

    const auto densityFactor = juce::jmap (
        juce::jlimit (0.0f, 1.0f, effectiveDensity), 0.0f, 1.0f, 4.2f, 0.42f);
    auto jitter = 1.0f + randomBipolar (stream.rng) * entropy * 0.72f;
    jitter = juce::jmax (0.24f, jitter);

    auto intervalBeats = baseIntervalBeats[streamIndex] * densityFactor * jitter;
    if (random01 (stream.rng) < entropy * 0.16f)
        intervalBeats *= 1.8f + 3.4f * random01 (stream.rng);

    stream.samplesUntilEvent = sampleRate * 60.0 / bpm
                               * juce::jmax (0.035f, intervalBeats);
}

void GenerativeEngine::retargetPan (int streamIndex, const Settings& settings)
{
    auto& stream = streams[static_cast<std::size_t> (streamIndex)];
    const auto spread = juce::jlimit (0.0f, 1.0f, settings.spread);
    const auto entropy = juce::jlimit (0.0f, 1.0f, settings.entropy);
    const auto maxPan = widthLimit[streamIndex] * spread;

    if (maxPan < 0.001f)
    {
        stream.panTarget = 0.0f;
        return;
    }

    auto bias = laneBias[streamIndex];
    if (random01 (stream.rng) < entropy * 0.22f)
        bias *= -1.0f;

    float bestCandidate = stream.panTarget;
    float bestScore = -1.0f;

    for (int attempt = 0; attempt < 4; ++attempt)
    {
        const auto wander = randomBipolar (stream.rng) * (0.16f + 0.54f * entropy);
        const auto candidate = juce::jlimit (-maxPan, maxPan, (bias + wander) * maxPan);

        float nearest = 2.0f;
        for (int other = 0; other < numStreams; ++other)
        {
            if (other == streamIndex)
                continue;

            nearest = juce::jmin (
                nearest,
                std::abs (candidate - streams[static_cast<std::size_t> (other)].panTarget));
        }

        const auto lanePreference = 0.08f * (1.0f - std::abs (candidate - bias * maxPan));
        const auto score = nearest + lanePreference;
        if (score > bestScore)
        {
            bestScore = score;
            bestCandidate = candidate;
        }
    }

    stream.panTarget = bestCandidate;
}

float GenerativeEngine::renderStream (Stream& stream,
                                      int streamIndex,
                                      const Settings& settings) noexcept
{
    juce::ignoreUnused (settings);

    const auto frequencySmoothing = static_cast<float> (
        juce::jlimit (0.00005, 0.004, 35.0 / sampleRate));
    stream.frequency += (stream.targetFrequency - stream.frequency) * frequencySmoothing;

    const auto env = stream.envelope;
    float sample = 0.0f;

    switch (stream.kind)
    {
        case Kind::foundation:
        {
            const auto fundamental = static_cast<float> (std::sin (stream.phase1));
            const auto detuned = static_cast<float> (std::sin (stream.phase2)) * 0.34f;
            sample = (fundamental + detuned) * 0.76f * std::sqrt (env);
            advancePhase (stream.phase1, stream.frequency, sampleRate);
            advancePhase (stream.phase2, stream.frequency * 1.006, sampleRate);
            break;
        }

        case Kind::body:
        {
            const auto fundamental = static_cast<float> (std::sin (stream.phase1));
            const auto third = static_cast<float> (std::sin (stream.phase1 * 3.0)) * 0.24f;
            const auto softDetune = static_cast<float> (std::sin (stream.phase2)) * 0.18f;
            sample = (fundamental + third + softDetune) * 0.68f * env;
            advancePhase (stream.phase1, stream.frequency, sampleRate);
            advancePhase (stream.phase2, stream.frequency * 0.501, sampleRate);
            break;
        }

        case Kind::pulse:
        {
            const auto pitchDrop = 1.0 + 1.8 * static_cast<double> (env * env);
            const auto tone = static_cast<float> (std::sin (stream.phase1));
            const auto click = randomBipolar (stream.rng) * env * env * env * env * 0.11f;
            sample = (tone * env * env + click) * 0.92f;
            advancePhase (stream.phase1, stream.frequency * pitchDrop, sampleRate);
            break;
        }

        case Kind::focus:
        {
            const auto p1 = static_cast<float> (std::sin (stream.phase1));
            const auto p2 = static_cast<float> (std::sin (stream.phase2)) * 0.48f;
            const auto p3 = static_cast<float> (std::sin (stream.phase1 * 3.97)) * 0.19f;
            sample = (p1 + p2 + p3) * 0.58f * env;
            advancePhase (stream.phase1, stream.frequency, sampleRate);
            advancePhase (stream.phase2, stream.frequency * 2.011, sampleRate);
            break;
        }

        case Kind::grain:
        {
            const auto tone = static_cast<float> (std::sin (stream.phase1));
            const auto grit = randomBipolar (stream.rng) * 0.19f;
            sample = (tone + grit) * 0.66f * env;
            advancePhase (stream.phase1, stream.frequency, sampleRate);
            break;
        }

        case Kind::air:
        {
            const auto noise = randomBipolar (stream.rng);
            stream.airLowpass += airFilterCoefficient * (noise - stream.airLowpass);
            const auto high = noise - stream.airLowpass;
            const auto breathe = 0.62f + 0.38f * static_cast<float> (std::sin (stream.lfoPhase * 0.47));
            sample = high * breathe * env * 0.72f;
            break;
        }
    }

    stream.envelope *= stream.envelopeDecay;
    if (stream.envelope < 0.00001f)
        stream.envelope = 0.0f;

    return sample * stream.eventAmplitude * (0.92f + 0.03f * static_cast<float> (streamIndex));
}

int GenerativeEngine::chooseMidiNote (int streamIndex, const Settings& settings) noexcept
{
    auto& stream = streams[static_cast<std::size_t> (streamIndex)];
    const auto mode = juce::jlimit (0, 4, settings.mode);
    const auto length = scaleLengthFor (mode);
    auto degree = static_cast<int> (nextRandom (stream.rng) % static_cast<std::uint32_t> (length));

    if (streamIndex == 0)
        degree = juce::jmin (degree, 3);

    static constexpr int baseMidi[numStreams] = { 24, 36, 31, 48, 60, 72 };
    auto octave = 0;
    const auto entropy = juce::jlimit (0.0f, 1.0f, settings.entropy);

    if (streamIndex == 1 && random01 (stream.rng) < 0.24f + 0.30f * entropy)
        octave = 12;
    else if (streamIndex == 3 && random01 (stream.rng) < 0.36f + 0.28f * entropy)
        octave = 12;
    else if (streamIndex == 4)
        octave = random01 (stream.rng) < 0.48f ? 12 : 24;

    const auto semitone = static_cast<int> (scaleDegreeFor (mode, degree));
    return juce::jlimit (20, 100,
                         baseMidi[streamIndex]
                             + juce::jlimit (0, 11, settings.root)
                             + semitone
                             + octave);
}

std::uint32_t GenerativeEngine::nextRandom (std::uint32_t& state) noexcept
{
    if (state == 0U)
        state = 0x6d2b79f5U;

    state ^= state << 13U;
    state ^= state >> 17U;
    state ^= state << 5U;
    return state;
}

float GenerativeEngine::random01 (std::uint32_t& state) noexcept
{
    return static_cast<float> (nextRandom (state) & 0x00ffffffU)
           / static_cast<float> (0x01000000U);
}

float GenerativeEngine::randomBipolar (std::uint32_t& state) noexcept
{
    return random01 (state) * 2.0f - 1.0f;
}

float GenerativeEngine::midiToHz (int midiNote) noexcept
{
    return 440.0f * std::pow (2.0f, (static_cast<float> (midiNote) - 69.0f) / 12.0f);
}

float GenerativeEngine::scaleDegreeFor (int mode, int degreeIndex) noexcept
{
    static constexpr int scales[5][7] = {
        { 0, 2, 3, 5, 7, 9, 10 },
        { 0, 2, 3, 5, 7, 8, 10 },
        { 0, 3, 5, 7, 10, 12, 15 },
        { 0, 2, 4, 7, 9, 12, 14 },
        { 0, 2, 5, 7, 10, 12, 14 }
    };

    const auto safeMode = juce::jlimit (0, 4, mode);
    const auto safeDegree = juce::jlimit (0, scaleLengthFor (safeMode) - 1, degreeIndex);
    return static_cast<float> (scales[safeMode][safeDegree]);
}

int GenerativeEngine::scaleLengthFor (int mode) noexcept
{
    switch (juce::jlimit (0, 4, mode))
    {
        case 2:
        case 3: return 5;
        default: return 7;
    }
}

void GenerativeEngine::advancePhase (double& phase,
                                     double frequency,
                                     double currentSampleRate) noexcept
{
    phase += twoPi * frequency / currentSampleRate;
    while (phase >= twoPi)
        phase -= twoPi;
}

GenerativeEngine::Telemetry GenerativeEngine::getTelemetry() const noexcept
{
    Telemetry telemetry;
    for (int i = 0; i < numStreams; ++i)
    {
        telemetry.levels[static_cast<std::size_t> (i)] =
            telemetryLevels[static_cast<std::size_t> (i)].load (std::memory_order_relaxed);
        telemetry.pans[static_cast<std::size_t> (i)] =
            telemetryPans[static_cast<std::size_t> (i)].load (std::memory_order_relaxed);
        telemetry.duckDb[static_cast<std::size_t> (i)] =
            telemetryDuckDb[static_cast<std::size_t> (i)].load (std::memory_order_relaxed);
    }

    telemetry.pressure = telemetryPressure.load (std::memory_order_relaxed);
    telemetry.adaptiveDensity = telemetryAdaptiveDensity.load (std::memory_order_relaxed);
    telemetry.outputRms = telemetryOutputRms.load (std::memory_order_relaxed);
    telemetry.bpm = telemetryBpm.load (std::memory_order_relaxed);
    telemetry.running = telemetryRunning.load (std::memory_order_relaxed);
    return telemetry;
}

const char* GenerativeEngine::streamName (int index) noexcept
{
    static constexpr const char* names[numStreams] = {
        "FOUNDATION", "BODY", "PULSE", "FOCUS", "GRAIN", "AIR"
    };

    return names[juce::jlimit (0, numStreams - 1, index)];
}
} // namespace mz
