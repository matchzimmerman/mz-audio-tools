#include "PluginProcessor.h"
#include "PluginEditor.h"

#include <cmath>

namespace
{
constexpr auto pi = juce::MathConstants<float>::pi;
constexpr auto twoPi = juce::MathConstants<float>::twoPi;

float equalPowerLeft (float pan) noexcept
{
    return std::cos ((juce::jlimit (-1.0f, 1.0f, pan) + 1.0f) * pi * 0.25f);
}

float equalPowerRight (float pan) noexcept
{
    return std::sin ((juce::jlimit (-1.0f, 1.0f, pan) + 1.0f) * pi * 0.25f);
}
}

SonarAudioProcessor::SonarAudioProcessor()
    : AudioProcessor (BusesProperties()
        .withInput ("Input", juce::AudioChannelSet::stereo(), true)
        .withOutput ("Output", juce::AudioChannelSet::stereo(), true)),
      parameters (*this, nullptr, "SONAR_PARAMETERS", createParameterLayout())
{
    lowPassLeft.setType (juce::dsp::StateVariableTPTFilterType::lowpass);
    lowPassRight.setType (juce::dsp::StateVariableTPTFilterType::lowpass);
}

void SonarAudioProcessor::prepareToPlay (double sampleRate, int samplesPerBlock)
{
    currentSampleRate = sampleRate;

    const juce::dsp::ProcessSpec stereoSpec {
        sampleRate,
        static_cast<juce::uint32> (samplesPerBlock),
        2
    };
    const juce::dsp::ProcessSpec monoSpec {
        sampleRate,
        static_cast<juce::uint32> (samplesPerBlock),
        1
    };

    lowPassLeft.prepare (monoSpec);
    lowPassRight.prepare (monoSpec);
    lowPassLeft.reset();
    lowPassRight.reset();

    compressor.prepare (stereoSpec);
    compressor.reset();
    reflectionLeft.prepare (monoSpec);
    reflectionRight.prepare (monoSpec);
    reflectionLeft.reset();
    reflectionRight.reset();
    reverb.reset();
    reverb.setSampleRate (sampleRate);

    dryBuffer.setSize (2, samplesPerBlock, false, false, true);
    wetBuffer.setSize (2, samplesPerBlock, false, false, true);
    reverbBuffer.setSize (2, samplesPerBlock, false, false, true);

    inputGain.reset (sampleRate, 0.025);
    outputGain.reset (sampleRate, 0.025);
    dryWet.reset (sampleRate, 0.04);
    inputGain.setCurrentAndTargetValue (juce::Decibels::decibelsToGain (
        parameterValue (parameters, "input")));
    outputGain.setCurrentAndTargetValue (juce::Decibels::decibelsToGain (
        parameterValue (parameters, "output")));
    dryWet.setCurrentAndTargetValue (parameterValue (parameters, "mix") / 100.0f);

    currentAngleValue = parameterValue (parameters, "angle") / 360.0f;
    targetAngleValue = currentAngleValue;
    currentDistanceValue = parameterValue (parameters, "distance") / 100.0f;
    targetDistanceValue = currentDistanceValue;
    internalPpq = 0.0;
    blockPpq = 0.0;
    lastSequenceStep = -1;
    pulseValue = 0.0f;
}

void SonarAudioProcessor::releaseResources()
{
    reverb.reset();
    reflectionLeft.reset();
    reflectionRight.reset();
}

bool SonarAudioProcessor::isBusesLayoutSupported (const BusesLayout& layouts) const
{
    return layouts.getMainInputChannelSet() == juce::AudioChannelSet::stereo()
        && layouts.getMainOutputChannelSet() == juce::AudioChannelSet::stereo();
}

void SonarAudioProcessor::processBlock (juce::AudioBuffer<float>& buffer,
                                        juce::MidiBuffer& midiMessages)
{
    juce::ScopedNoDenormals noDenormals;
    midiMessages.clear();

    if (buffer.getNumChannels() < 2)
        return;

    const auto numSamples = buffer.getNumSamples();
    if (numSamples <= 0)
        return;

    if (dryBuffer.getNumSamples() < numSamples)
    {
        dryBuffer.setSize (2, numSamples, false, false, true);
        wetBuffer.setSize (2, numSamples, false, false, true);
        reverbBuffer.setSize (2, numSamples, false, false, true);
    }

    dryBuffer.copyFrom (0, 0, buffer, 0, 0, numSamples);
    dryBuffer.copyFrom (1, 0, buffer, 1, 0, numSamples);
    wetBuffer.clear();
    reverbBuffer.clear();

    updateTransport (numSamples);
    updateSpatialTarget();

    inputGain.setTargetValue (juce::Decibels::decibelsToGain (
        parameterValue (parameters, "input")));
    outputGain.setTargetValue (juce::Decibels::decibelsToGain (
        parameterValue (parameters, "output")));
    dryWet.setTargetValue (parameterValue (parameters, "mix") / 100.0f);

    const auto motionMode = juce::roundToInt (parameterValue (parameters, "mode"));
    const auto clockwiseMotion = parameterValue (parameters, "clockwise") > 0.5f;
    const auto rearControl = parameterValue (parameters, "rear") / 100.0f;
    const auto spaceControl = parameterValue (parameters, "space") / 100.0f;
    const auto monitorMode = juce::roundToInt (parameterValue (parameters, "monitor"));
    const auto smoothingControl = parameterValue (parameters, "smooth") / 100.0f;
    const auto smoothingMs = 6.0f * std::pow (140.0f, smoothingControl);
    const auto smoothingCoefficient = 1.0f - std::exp (
        -1.0f / (0.001f * smoothingMs * static_cast<float> (currentSampleRate)));
    const auto pulseDecay = std::exp (
        -1.0f / (0.16f * static_cast<float> (currentSampleRate)));

    configureSpaceProcessors (targetDistanceValue, rearControl, spaceControl);

    auto* wetLeft = wetBuffer.getWritePointer (0);
    auto* wetRight = wetBuffer.getWritePointer (1);
    const auto* dryLeft = dryBuffer.getReadPointer (0);
    const auto* dryRight = dryBuffer.getReadPointer (1);

    for (auto sample = 0; sample < numSamples; ++sample)
    {
        if (blockIsPlaying || ! hostPositionAvailable)
        {
            blockPpq += ppqPerSample;
            const auto cyclePosition = std::fmod (blockPpq, beatsPerCycle);
            const auto phase = static_cast<float> ((cyclePosition < 0.0
                ? cyclePosition + beatsPerCycle
                : cyclePosition) / beatsPerCycle);
            sweepPhase.store (phase);
        }

        if (motionMode == 1)
            targetAngleValue = clockwiseMotion ? sweepPhase.load() : wrapUnit (1.0f - sweepPhase.load());
        else if (motionMode == 2)
            updateSpatialTarget();

        currentAngleValue = wrapUnit (currentAngleValue
            + shortestTurn (currentAngleValue, targetAngleValue) * smoothingCoefficient);
        currentDistanceValue += (targetDistanceValue - currentDistanceValue) * smoothingCoefficient;
        pulseValue *= pulseDecay;

        const auto angle = currentAngleValue * twoPi;
        const auto pan = std::sin (angle);
        const auto frontness = std::cos (angle);
        const auto behind = juce::jmax (0.0f, -frontness) * rearControl;
        const auto distance = juce::jlimit (0.0f, 1.0f, currentDistanceValue);
        const auto inGain = inputGain.getNextValue();

        const auto inputL = dryLeft[sample] * inGain;
        const auto inputR = dryRight[sample] * inGain;
        const auto mid = (inputL + inputR) * 0.5f;
        const auto side = (inputL - inputR) * 0.5f;

        const auto width = juce::jlimit (0.12f, 1.0f,
            1.0f - distance * 0.64f - behind * 0.18f);
        const auto panL = equalPowerLeft (pan) * juce::MathConstants<float>::sqrt2;
        const auto panR = equalPowerRight (pan) * juce::MathConstants<float>::sqrt2;

        auto positionedL = mid * panL + side * width;
        auto positionedR = mid * panR - side * width;

        const auto speakerCrossfeed = monitorMode == 0 ? 0.12f : 0.035f;
        const auto crossfeed = speakerCrossfeed + behind * 0.30f + distance * 0.07f;
        const auto crossedL = positionedL * (1.0f - crossfeed) + positionedR * crossfeed;
        const auto crossedR = positionedR * (1.0f - crossfeed) + positionedL * crossfeed;
        positionedL = crossedL;
        positionedR = crossedR;

        const auto cutoff = juce::jlimit (700.0f,
            static_cast<float> (currentSampleRate * 0.45),
            18000.0f * std::pow (0.105f, distance) * (1.0f - behind * 0.28f));
        lowPassLeft.setCutoffFrequency (cutoff);
        lowPassRight.setCutoffFrequency (cutoff);

        positionedL = lowPassLeft.processSample (0, positionedL);
        positionedR = lowPassRight.processSample (0, positionedR);

        const auto directGain = juce::jmap (distance, 0.0f, 1.0f, 1.0f, 0.26f);
        const auto reflectionGain = (0.04f + distance * 0.40f + behind * 0.16f)
            * (0.72f + spaceControl * 0.55f);
        const auto angleOffset = std::abs (pan);
        const auto leftDelayMs = 8.0f + distance * 29.0f + (pan > 0.0f ? angleOffset * 5.0f : 0.0f);
        const auto rightDelayMs = 11.0f + distance * 34.0f + (pan < 0.0f ? angleOffset * 5.0f : 0.0f);

        reflectionLeft.pushSample (0, positionedL);
        reflectionRight.pushSample (0, positionedR);
        const auto reflectionL = reflectionLeft.popSample (
            0, leftDelayMs * static_cast<float> (currentSampleRate) / 1000.0f);
        const auto reflectionR = reflectionRight.popSample (
            0, rightDelayMs * static_cast<float> (currentSampleRate) / 1000.0f);

        wetLeft[sample] = positionedL * directGain + reflectionR * reflectionGain;
        wetRight[sample] = positionedR * directGain + reflectionL * reflectionGain;
    }

    {
        juce::dsp::AudioBlock<float> wetBlock (wetBuffer);
        juce::dsp::ProcessContextReplacing<float> wetContext (wetBlock);
        compressor.process (wetContext);
    }

    reverbBuffer.copyFrom (0, 0, wetBuffer, 0, 0, numSamples);
    reverbBuffer.copyFrom (1, 0, wetBuffer, 1, 0, numSamples);
    reverb.processStereo (reverbBuffer.getWritePointer (0),
                          reverbBuffer.getWritePointer (1),
                          numSamples);

    auto* outLeft = buffer.getWritePointer (0);
    auto* outRight = buffer.getWritePointer (1);
    const auto* processedLeft = wetBuffer.getReadPointer (0);
    const auto* processedRight = wetBuffer.getReadPointer (1);
    const auto* verbLeft = reverbBuffer.getReadPointer (0);
    const auto* verbRight = reverbBuffer.getReadPointer (1);
    const auto reverbBlend = juce::jlimit (0.0f, 0.88f,
        (0.04f + currentDistanceValue * 0.62f) * spaceControl);

    for (auto sample = 0; sample < numSamples; ++sample)
    {
        const auto mixValue = juce::jlimit (0.0f, 1.0f,
            dryWet.getNextValue() * (0.9f + pulseValue * 0.1f));
        const auto spatialL = processedLeft[sample] * (1.0f - reverbBlend)
                            + verbLeft[sample] * reverbBlend;
        const auto spatialR = processedRight[sample] * (1.0f - reverbBlend)
                            + verbRight[sample] * reverbBlend;
        const auto gain = outputGain.getNextValue();

        outLeft[sample] = std::tanh ((dryLeft[sample] * (1.0f - mixValue) + spatialL * mixValue) * gain);
        outRight[sample] = std::tanh ((dryRight[sample] * (1.0f - mixValue) + spatialR * mixValue) * gain);
    }

    objectAngle.store (currentAngleValue);
    objectDistance.store (currentDistanceValue);
    encounterPulse.store (pulseValue);
}

void SonarAudioProcessor::updateTransport (int numSamples)
{
    static constexpr std::array<double, 4> cycleBars { 1.0, 2.0, 4.0, 8.0 };
    const auto cycleIndex = juce::jlimit (0, 3,
        juce::roundToInt (parameterValue (parameters, "cycleBars")));

    auto beatsPerBar = 4.0;
    hostPositionAvailable = false;
    blockIsPlaying = false;

    if (auto* playHead = getPlayHead())
    {
        if (const auto position = playHead->getPosition())
        {
            if (const auto bpm = position->getBpm())
                currentBpm = juce::jlimit (20.0, 400.0, *bpm);

            if (const auto signature = position->getTimeSignature())
                beatsPerBar = juce::jmax (1.0, static_cast<double> (signature->numerator));

            if (const auto ppq = position->getPpqPosition())
            {
                blockPpq = *ppq;
                hostPositionAvailable = true;
            }

            blockIsPlaying = position->getIsPlaying();
        }
    }

    beatsPerCycle = juce::jmax (1.0, cycleBars[static_cast<size_t> (cycleIndex)] * beatsPerBar);
    ppqPerSample = currentBpm / (60.0 * currentSampleRate);

    if (! hostPositionAvailable)
    {
        blockPpq = internalPpq;
        blockIsPlaying = true;
        internalPpq += ppqPerSample * static_cast<double> (numSamples);
    }

    const auto cyclePosition = std::fmod (blockPpq, beatsPerCycle);
    const auto phase = static_cast<float> ((cyclePosition < 0.0
        ? cyclePosition + beatsPerCycle
        : cyclePosition) / beatsPerCycle);
    sweepPhase.store (phase);
    transportRunning.store (blockIsPlaying);
}

void SonarAudioProcessor::updateSpatialTarget()
{
    const auto modeValue = juce::roundToInt (parameterValue (parameters, "mode"));
    const auto phase = sweepPhase.load();
    const auto step = juce::jlimit (0, 15, static_cast<int> (std::floor (phase * 16.0f)));
    currentStep.store (step);

    if (modeValue == 0)
    {
        targetAngleValue = parameterValue (parameters, "angle") / 360.0f;
        targetDistanceValue = parameterValue (parameters, "distance") / 100.0f;
        lastSequenceStep = step;
        return;
    }

    if (modeValue == 1)
    {
        targetDistanceValue = parameterValue (parameters, "distance") / 100.0f;
        lastSequenceStep = step;
        return;
    }

    if (step == lastSequenceStep)
        return;

    lastSequenceStep = step;
    const auto id = stepParameterId (step);
    const auto ring = juce::roundToInt (parameters.getRawParameterValue (id)->load());

    if (ring > 0)
    {
        const auto clockwise = parameterValue (parameters, "clockwise") > 0.5f;
        const auto sector = (static_cast<float> (step) + 0.5f) / 16.0f;
        targetAngleValue = clockwise ? sector : wrapUnit (1.0f - sector);
        targetDistanceValue = ringToDistance (ring);
        pulseValue = 1.0f;
    }
}

void SonarAudioProcessor::configureSpaceProcessors (float distance,
                                                     float rearAmount,
                                                     float spaceAmount)
{
    compressor.setThreshold (-8.0f - distance * 18.0f);
    compressor.setRatio (1.0f + distance * 4.5f);
    compressor.setAttack (5.0f + distance * 22.0f);
    compressor.setRelease (90.0f + distance * 260.0f);

    juce::Reverb::Parameters settings;
    settings.roomSize = juce::jlimit (0.0f, 1.0f,
        0.18f + distance * 0.62f + spaceAmount * 0.18f);
    settings.damping = juce::jlimit (0.0f, 1.0f,
        0.24f + distance * 0.52f + rearAmount * 0.12f);
    settings.wetLevel = 1.0f;
    settings.dryLevel = 0.0f;
    settings.width = juce::jlimit (0.15f, 1.0f, 0.92f - distance * 0.36f);
    settings.freezeMode = 0.0f;
    reverb.setParameters (settings);
}

float SonarAudioProcessor::parameterValue (const juce::AudioProcessorValueTreeState& state,
                                           const char* id) noexcept
{
    return state.getRawParameterValue (id)->load();
}

float SonarAudioProcessor::wrapUnit (float value) noexcept
{
    value -= std::floor (value);
    return value;
}

float SonarAudioProcessor::shortestTurn (float from, float to) noexcept
{
    auto difference = wrapUnit (to) - wrapUnit (from);
    if (difference > 0.5f)
        difference -= 1.0f;
    else if (difference < -0.5f)
        difference += 1.0f;
    return difference;
}

float SonarAudioProcessor::ringToDistance (int ring) noexcept
{
    static constexpr std::array<float, 5> distances { 0.25f, 0.10f, 0.36f, 0.66f, 0.96f };
    return distances[static_cast<size_t> (juce::jlimit (0, 4, ring))];
}

juce::String SonarAudioProcessor::stepParameterId (int index)
{
    return "step" + juce::String (index + 1).paddedLeft ('0', 2);
}

juce::AudioProcessorValueTreeState::ParameterLayout
SonarAudioProcessor::createParameterLayout()
{
    using ID = juce::ParameterID;
    using Range = juce::NormalisableRange<float>;

    std::vector<std::unique_ptr<juce::RangedAudioParameter>> layout;

    layout.push_back (std::make_unique<juce::AudioParameterChoice> (
        ID { "mode", 1 }, "Motion Mode",
        juce::StringArray { "Static", "Orbit", "Sequence" }, 2));
    layout.push_back (std::make_unique<juce::AudioParameterChoice> (
        ID { "cycleBars", 1 }, "Cycle Length",
        juce::StringArray { "1 Bar", "2 Bars", "4 Bars", "8 Bars" }, 1));
    layout.push_back (std::make_unique<juce::AudioParameterBool> (
        ID { "clockwise", 1 }, "Clockwise", true));
    layout.push_back (std::make_unique<juce::AudioParameterChoice> (
        ID { "monitor", 1 }, "Monitor Mode",
        juce::StringArray { "Speakers", "Headphones" }, 0));

    layout.push_back (std::make_unique<juce::AudioParameterFloat> (
        ID { "angle", 1 }, "Static Angle",
        Range { 0.0f, 360.0f, 0.1f }, 0.0f));
    layout.push_back (std::make_unique<juce::AudioParameterFloat> (
        ID { "distance", 1 }, "Distance",
        Range { 0.0f, 100.0f, 0.1f }, 28.0f));
    layout.push_back (std::make_unique<juce::AudioParameterFloat> (
        ID { "smooth", 1 }, "Motion Smoothing",
        Range { 0.0f, 100.0f, 0.1f }, 32.0f));
    layout.push_back (std::make_unique<juce::AudioParameterFloat> (
        ID { "rear", 1 }, "Rear Illusion",
        Range { 0.0f, 100.0f, 0.1f }, 62.0f));
    layout.push_back (std::make_unique<juce::AudioParameterFloat> (
        ID { "space", 1 }, "Space",
        Range { 0.0f, 100.0f, 0.1f }, 58.0f));
    layout.push_back (std::make_unique<juce::AudioParameterFloat> (
        ID { "mix", 1 }, "Dry Wet",
        Range { 0.0f, 100.0f, 0.1f }, 100.0f));
    layout.push_back (std::make_unique<juce::AudioParameterFloat> (
        ID { "input", 1 }, "Input Gain",
        Range { -24.0f, 12.0f, 0.1f }, 0.0f));
    layout.push_back (std::make_unique<juce::AudioParameterFloat> (
        ID { "output", 1 }, "Output Gain",
        Range { -24.0f, 6.0f, 0.1f }, -1.5f));

    const juce::StringArray ringChoices { "Off", "Ring 1", "Ring 2", "Ring 3", "Ring 4" };
    for (auto step = 0; step < 16; ++step)
    {
        const auto defaultRing = step == 3 ? 2 : (step == 11 ? 4 : 0);
        layout.push_back (std::make_unique<juce::AudioParameterChoice> (
            ID { stepParameterId (step), 1 },
            "Step " + juce::String (step + 1),
            ringChoices,
            defaultRing));
    }

    return { layout.begin(), layout.end() };
}

void SonarAudioProcessor::getStateInformation (juce::MemoryBlock& destData)
{
    if (auto xml = parameters.copyState().createXml())
        copyXmlToBinary (*xml, destData);
}

void SonarAudioProcessor::setStateInformation (const void* data, int sizeInBytes)
{
    if (auto xml = getXmlFromBinary (data, sizeInBytes))
        if (xml->hasTagName (parameters.state.getType()))
            parameters.replaceState (juce::ValueTree::fromXml (*xml));
}

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new SonarAudioProcessor();
}
