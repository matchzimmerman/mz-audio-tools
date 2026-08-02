#include "PluginProcessor.h"
#include "PluginEditor.h"

#include <array>
#include <cmath>

namespace
{
constexpr auto twoPi = juce::MathConstants<float>::twoPi;

float getParameter (const juce::AudioProcessorValueTreeState& state, const char* id)
{
    return state.getRawParameterValue (id)->load();
}
}

CoastsAudioProcessor::CoastsAudioProcessor()
    : AudioProcessor (BusesProperties().withOutput ("Output", juce::AudioChannelSet::stereo(), true)),
      parameters (*this, nullptr, "COASTS_PARAMETERS", createParameterLayout())
{
    eastFilter1.setType (juce::dsp::StateVariableTPTFilterType::lowpass);
    eastFilter2.setType (juce::dsp::StateVariableTPTFilterType::lowpass);
    westLowPassGate.setType (juce::dsp::StateVariableTPTFilterType::lowpass);
}

void CoastsAudioProcessor::prepareToPlay (double sampleRate, int samplesPerBlock)
{
    currentSampleRate = sampleRate;

    const juce::dsp::ProcessSpec spec {
        sampleRate,
        static_cast<juce::uint32> (samplesPerBlock),
        1
    };

    eastFilter1.prepare (spec);
    eastFilter2.prepare (spec);
    westLowPassGate.prepare (spec);

    eastFilter1.reset();
    eastFilter2.reset();
    westLowPassGate.reset();

    eastAmpEnvelope.setSampleRate (sampleRate);
    eastFilterEnvelope.setSampleRate (sampleRate);
    updateEnvelopeParameters();

    masterGain.reset (sampleRate, 0.02);
    masterGain.setCurrentAndTargetValue (
        juce::Decibels::decibelsToGain (getParameter (parameters, "masterGain")));

    allNotesOff();
    outputLevel.store (0.0f);
}

void CoastsAudioProcessor::releaseResources()
{
    allNotesOff();
}

bool CoastsAudioProcessor::isBusesLayoutSupported (const BusesLayout& layouts) const
{
    const auto output = layouts.getMainOutputChannelSet();
    return output == juce::AudioChannelSet::mono()
        || output == juce::AudioChannelSet::stereo();
}

void CoastsAudioProcessor::processBlock (juce::AudioBuffer<float>& buffer,
                                         juce::MidiBuffer& midiMessages)
{
    juce::ScopedNoDenormals noDenormals;
    buffer.clear();

    const auto mode = juce::roundToInt (getParameter (parameters, "mode"));
    if (mode != lastMode)
    {
        allNotesOff();
        lastMode = mode;
    }

    updateEnvelopeParameters();
    masterGain.setTargetValue (
        juce::Decibels::decibelsToGain (getParameter (parameters, "masterGain")));

    auto cursor = 0;
    const auto totalSamples = buffer.getNumSamples();

    for (const auto metadata : midiMessages)
    {
        const auto eventSample = juce::jlimit (0, totalSamples, metadata.samplePosition);
        if (eventSample > cursor)
            renderRange (buffer, cursor, eventSample - cursor);

        handleMidiMessage (metadata.getMessage());
        cursor = eventSample;
    }

    if (cursor < totalSamples)
        renderRange (buffer, cursor, totalSamples - cursor);

    midiMessages.clear();

    auto peak = 0.0f;
    for (auto channel = 0; channel < buffer.getNumChannels(); ++channel)
        peak = juce::jmax (peak, buffer.getMagnitude (channel, 0, totalSamples));

    const auto previous = outputLevel.load();
    outputLevel.store (juce::jmax (peak, previous * 0.88f));
}

void CoastsAudioProcessor::renderRange (juce::AudioBuffer<float>& buffer,
                                        int startSample,
                                        int numSamples)
{
    if (numSamples <= 0)
        return;

    auto* left = buffer.getWritePointer (0, startSample);
    auto* right = buffer.getNumChannels() > 1
        ? buffer.getWritePointer (1, startSample)
        : nullptr;

    for (auto sampleIndex = 0; sampleIndex < numSamples; ++sampleIndex)
    {
        auto sample = lastMode == 0 ? renderEastSample() : renderWestSample();

        // A soft safety stage mirrors the protected browser output chain and
        // keeps aggressive resonance/folding inside a predictable range.
        sample = std::tanh (sample * 1.35f) * 0.82f;
        sample *= masterGain.getNextValue();

        left[sampleIndex] = sample;
        if (right != nullptr)
            right[sampleIndex] = sample;
    }
}

void CoastsAudioProcessor::handleMidiMessage (const juce::MidiMessage& message)
{
    if (message.isNoteOn())
    {
        noteOn (message.getNoteNumber(), message.getFloatVelocity());
        return;
    }

    if (message.isNoteOff())
    {
        noteOff (message.getNoteNumber());
        return;
    }

    if (message.isAllNotesOff() || message.isAllSoundOff())
        allNotesOff();
}

void CoastsAudioProcessor::noteOn (int midiNote, float velocity)
{
    allNotesOff();

    currentNote = midiNote;
    currentVelocity = juce::jlimit (0.0f, 1.0f, velocity);
    keyDown = true;
    activeMidiNote.store (midiNote);

    if (lastMode == 0)
    {
        eastPhase1 = 0.0f;
        eastPhase2 = 0.0f;
        eastFilter1.reset();
        eastFilter2.reset();
        eastAmpEnvelope.noteOn();
        eastFilterEnvelope.noteOn();
    }
    else
    {
        westCarrierPhase = 0.0f;
        westModPhase = 0.0f;
        westEnvelope = 0.0f;
        westPitchOffsetCents = (random.nextFloat() * 2.0f - 1.0f)
            * getParameter (parameters, "westUncertainty");
        westFoldOffset = (random.nextFloat() * 2.0f - 1.0f)
            * getParameter (parameters, "westUncertainty") * 0.18f;
        westStage = WestStage::rise;
        westLowPassGate.reset();
    }
}

void CoastsAudioProcessor::noteOff (int midiNote)
{
    if (midiNote != currentNote)
        return;

    keyDown = false;

    if (lastMode == 0)
    {
        eastAmpEnvelope.noteOff();
        eastFilterEnvelope.noteOff();
    }
    else if (westStage != WestStage::idle)
    {
        westStage = WestStage::release;
    }
}

void CoastsAudioProcessor::allNotesOff()
{
    currentNote = -1;
    keyDown = false;
    activeMidiNote.store (-1);

    eastAmpEnvelope.reset();
    eastFilterEnvelope.reset();
    westEnvelope = 0.0f;
    westStage = WestStage::idle;
}

float CoastsAudioProcessor::renderEastSample()
{
    if (! eastAmpEnvelope.isActive() || currentNote < 0)
    {
        if (! eastAmpEnvelope.isActive())
        {
            currentNote = -1;
            activeMidiNote.store (-1);
        }
        return 0.0f;
    }

    const auto frequency1 = static_cast<float> (
        juce::MidiMessage::getMidiNoteInHertz (currentNote));
    const auto detune = getParameter (parameters, "eastDetune");
    const auto frequency2 = frequency1 * std::pow (2.0f, detune / 1200.0f);

    const auto oscillator1 = juce::roundToInt (getParameter (parameters, "eastOsc1"));
    const auto oscillator2 = juce::roundToInt (getParameter (parameters, "eastOsc2"));
    const auto balance = getParameter (parameters, "eastBalance") / 100.0f;

    const auto gain1 = std::cos (balance * juce::MathConstants<float>::halfPi) * 0.48f;
    const auto gain2 = std::sin (balance * juce::MathConstants<float>::halfPi) * 0.48f;

    const auto source = renderOscillator (eastPhase1, oscillator1) * gain1
                      + renderOscillator (eastPhase2, oscillator2) * gain2;

    eastPhase1 = wrapPhase (eastPhase1 + frequency1 / static_cast<float> (currentSampleRate));
    eastPhase2 = wrapPhase (eastPhase2 + frequency2 / static_cast<float> (currentSampleRate));

    const auto filterContour = eastFilterEnvelope.getNextSample();
    const auto baseCutoff = cutoffFromControl (getParameter (parameters, "eastCutoff"));
    const auto filterAmount = getParameter (parameters, "eastFilterEnv");
    const auto peakCutoff = juce::jmin (18000.0f,
        baseCutoff * (1.0f + filterAmount / 8.0f));
    const auto cutoff = juce::jlimit (40.0f,
        static_cast<float> (currentSampleRate * 0.45),
        baseCutoff + (peakCutoff - baseCutoff) * filterContour);

    const auto resonance = getParameter (parameters, "eastResonance");
    eastFilter1.setCutoffFrequency (cutoff);
    eastFilter2.setCutoffFrequency (cutoff);
    eastFilter1.setResonance (0.8f + resonance * 0.105f);
    eastFilter2.setResonance (0.35f + resonance * 0.035f);

    auto filtered = eastFilter1.processSample (0, source);
    filtered = eastFilter2.processSample (0, filtered);

    return filtered * eastAmpEnvelope.getNextSample() * 0.68f;
}

float CoastsAudioProcessor::renderWestSample()
{
    if (westStage == WestStage::idle || currentNote < 0)
    {
        currentNote = -1;
        activeMidiNote.store (-1);
        return 0.0f;
    }

    const auto rise = timeFromControl (
        getParameter (parameters, "westRise"), 0.004f, 1.35f);
    const auto fall = timeFromControl (
        getParameter (parameters, "westFall"), 0.035f, 2.8f)
        * (0.65f + getParameter (parameters, "westRing") / 55.0f);

    switch (westStage)
    {
        case WestStage::rise:
            westEnvelope += 1.0f / juce::jmax (1.0f,
                rise * static_cast<float> (currentSampleRate));
            if (westEnvelope >= 1.0f)
            {
                westEnvelope = 1.0f;
                westStage = WestStage::fall;
            }
            break;

        case WestStage::fall:
            westEnvelope -= 1.0f / juce::jmax (1.0f,
                fall * static_cast<float> (currentSampleRate));
            if (westEnvelope <= 0.0f)
            {
                westEnvelope = 0.0f;
                const auto looping = getParameter (parameters, "westLoop") > 0.5f;
                westStage = looping && keyDown ? WestStage::rise : WestStage::idle;
            }
            break;

        case WestStage::release:
        {
            const auto coefficient = std::exp (
                std::log (0.0001f) / (0.12f * static_cast<float> (currentSampleRate)));
            westEnvelope *= coefficient;
            if (westEnvelope < 0.0001f)
            {
                westEnvelope = 0.0f;
                westStage = WestStage::idle;
            }
            break;
        }

        case WestStage::idle:
            break;
    }

    if (westStage == WestStage::idle)
    {
        currentNote = -1;
        activeMidiNote.store (-1);
        return 0.0f;
    }

    static constexpr std::array<float, 6> ratios { 0.5f, 1.0f, 1.5f, 2.0f, 3.0f, 4.0f };
    const auto ratioIndex = juce::jlimit (0, 5,
        juce::roundToInt (getParameter (parameters, "westRatio")));
    const auto ratio = ratios[static_cast<size_t> (ratioIndex)];

    const auto baseFrequency = static_cast<float> (
        juce::MidiMessage::getMidiNoteInHertz (currentNote))
        * std::pow (2.0f, westPitchOffsetCents / 1200.0f);

    const auto modulator = std::sin (twoPi * westModPhase);
    const auto modulationDepth = baseFrequency
        * (getParameter (parameters, "westFm") / 100.0f)
        * (1.6f + currentVelocity * 3.2f);
    const auto instantaneousFrequency = juce::jlimit (
        0.0f,
        static_cast<float> (currentSampleRate * 0.45),
        baseFrequency + modulator * modulationDepth);

    westModPhase = wrapPhase (westModPhase
        + (baseFrequency * ratio) / static_cast<float> (currentSampleRate));
    westCarrierPhase = wrapPhase (westCarrierPhase
        + instantaneousFrequency / static_cast<float> (currentSampleRate));

    const auto carrier = std::sin (twoPi * westCarrierPhase);
    const auto fold = juce::jlimit (0.0f, 100.0f,
        getParameter (parameters, "westFold")
        + westFoldOffset
        + currentVelocity * 18.0f - 9.0f);
    const auto drive = 1.0f + (fold / 100.0f) * 9.0f;
    const auto bias = ((getParameter (parameters, "westSymmetry") - 50.0f) / 50.0f) * 0.34f;
    const auto shifted = juce::jlimit (-1.5f, 1.5f, carrier + bias);
    const auto folded = std::sin (shifted * drive * juce::MathConstants<float>::halfPi) * 0.86f;

    const auto color = getParameter (parameters, "westColor") / 100.0f;
    const auto maximumCutoff = 420.0f + std::pow (color, 1.7f) * 14500.0f;
    const auto cutoff = juce::jlimit (95.0f,
        static_cast<float> (currentSampleRate * 0.45),
        95.0f + westEnvelope * (maximumCutoff - 95.0f));

    westLowPassGate.setCutoffFrequency (cutoff);
    westLowPassGate.setResonance (0.65f);

    return westLowPassGate.processSample (0, folded) * westEnvelope * 0.72f;
}

float CoastsAudioProcessor::renderOscillator (float phase, int waveform) const noexcept
{
    switch (waveform)
    {
        case 1:  return phase < 0.5f ? 1.0f : -1.0f;
        case 2:  return 1.0f - 4.0f * std::abs (phase - 0.5f);
        case 0:
        default: return phase * 2.0f - 1.0f;
    }
}

float CoastsAudioProcessor::cutoffFromControl (float value) const noexcept
{
    return juce::jmin (16000.0f, 38.0f * std::pow (2.0f, value / 11.5f));
}

float CoastsAudioProcessor::timeFromControl (float value,
                                              float minimum,
                                              float maximum) const noexcept
{
    return minimum * std::pow (maximum / minimum, value / 100.0f);
}

float CoastsAudioProcessor::wrapPhase (float phase) const noexcept
{
    phase -= std::floor (phase);
    return phase;
}

void CoastsAudioProcessor::updateEnvelopeParameters()
{
    const auto attack = timeFromControl (
        getParameter (parameters, "eastAttack"), 0.004f, 1.7f);
    const auto decay = timeFromControl (
        getParameter (parameters, "eastDecay"), 0.025f, 2.4f);
    const auto sustain = juce::jmax (0.03f,
        getParameter (parameters, "eastSustain") / 100.0f);
    const auto release = timeFromControl (
        getParameter (parameters, "eastRelease"), 0.025f, 3.2f);

    eastAmpEnvelope.setParameters ({ attack, decay, sustain, release });
    eastFilterEnvelope.setParameters ({ attack, decay, 0.0f, 0.05f });
}

juce::AudioProcessorValueTreeState::ParameterLayout
CoastsAudioProcessor::createParameterLayout()
{
    using ID = juce::ParameterID;
    using Range = juce::NormalisableRange<float>;

    std::vector<std::unique_ptr<juce::RangedAudioParameter>> layout;

    layout.push_back (std::make_unique<juce::AudioParameterChoice> (
        ID { "mode", 1 }, "Synthesis Philosophy",
        juce::StringArray { "East Coast", "West Coast" }, 0));
    layout.push_back (std::make_unique<juce::AudioParameterFloat> (
        ID { "masterGain", 1 }, "Output", Range { -36.0f, 0.0f, 0.1f }, -4.7f));

    layout.push_back (std::make_unique<juce::AudioParameterChoice> (
        ID { "eastOsc1", 1 }, "East Oscillator 1",
        juce::StringArray { "Saw", "Pulse", "Triangle" }, 0));
    layout.push_back (std::make_unique<juce::AudioParameterChoice> (
        ID { "eastOsc2", 1 }, "East Oscillator 2",
        juce::StringArray { "Saw", "Pulse", "Triangle" }, 1));
    layout.push_back (std::make_unique<juce::AudioParameterFloat> (
        ID { "eastDetune", 1 }, "East Detune", Range { -50.0f, 50.0f, 1.0f }, 7.0f));
    layout.push_back (std::make_unique<juce::AudioParameterFloat> (
        ID { "eastBalance", 1 }, "East Balance", Range { 0.0f, 100.0f, 0.1f }, 42.0f));
    layout.push_back (std::make_unique<juce::AudioParameterFloat> (
        ID { "eastCutoff", 1 }, "East Cutoff", Range { 0.0f, 100.0f, 0.1f }, 56.0f));
    layout.push_back (std::make_unique<juce::AudioParameterFloat> (
        ID { "eastResonance", 1 }, "East Resonance", Range { 0.0f, 100.0f, 0.1f }, 36.0f));
    layout.push_back (std::make_unique<juce::AudioParameterFloat> (
        ID { "eastFilterEnv", 1 }, "East Filter Envelope", Range { 0.0f, 100.0f, 0.1f }, 68.0f));
    layout.push_back (std::make_unique<juce::AudioParameterFloat> (
        ID { "eastAttack", 1 }, "East Attack", Range { 0.0f, 100.0f, 0.1f }, 4.0f));
    layout.push_back (std::make_unique<juce::AudioParameterFloat> (
        ID { "eastDecay", 1 }, "East Decay", Range { 0.0f, 100.0f, 0.1f }, 34.0f));
    layout.push_back (std::make_unique<juce::AudioParameterFloat> (
        ID { "eastSustain", 1 }, "East Sustain", Range { 0.0f, 100.0f, 0.1f }, 61.0f));
    layout.push_back (std::make_unique<juce::AudioParameterFloat> (
        ID { "eastRelease", 1 }, "East Release", Range { 0.0f, 100.0f, 0.1f }, 28.0f));

    layout.push_back (std::make_unique<juce::AudioParameterChoice> (
        ID { "westRatio", 1 }, "West Modulation Ratio",
        juce::StringArray { "0.5:1", "1:1", "1.5:1", "2:1", "3:1", "4:1" }, 3));
    layout.push_back (std::make_unique<juce::AudioParameterFloat> (
        ID { "westFm", 1 }, "West FM Index", Range { 0.0f, 100.0f, 0.1f }, 34.0f));
    layout.push_back (std::make_unique<juce::AudioParameterFloat> (
        ID { "westFold", 1 }, "West Fold", Range { 0.0f, 100.0f, 0.1f }, 62.0f));
    layout.push_back (std::make_unique<juce::AudioParameterFloat> (
        ID { "westSymmetry", 1 }, "West Symmetry", Range { 0.0f, 100.0f, 0.1f }, 50.0f));
    layout.push_back (std::make_unique<juce::AudioParameterFloat> (
        ID { "westUncertainty", 1 }, "West Uncertainty", Range { 0.0f, 100.0f, 0.1f }, 8.0f));
    layout.push_back (std::make_unique<juce::AudioParameterFloat> (
        ID { "westRise", 1 }, "West Rise", Range { 0.0f, 100.0f, 0.1f }, 3.0f));
    layout.push_back (std::make_unique<juce::AudioParameterFloat> (
        ID { "westFall", 1 }, "West Fall", Range { 0.0f, 100.0f, 0.1f }, 38.0f));
    layout.push_back (std::make_unique<juce::AudioParameterBool> (
        ID { "westLoop", 1 }, "West Cycler", false));
    layout.push_back (std::make_unique<juce::AudioParameterFloat> (
        ID { "westColor", 1 }, "West Color", Range { 0.0f, 100.0f, 0.1f }, 72.0f));
    layout.push_back (std::make_unique<juce::AudioParameterFloat> (
        ID { "westRing", 1 }, "West Ring", Range { 0.0f, 100.0f, 0.1f }, 34.0f));

    return { layout.begin(), layout.end() };
}

void CoastsAudioProcessor::getStateInformation (juce::MemoryBlock& destData)
{
    if (auto xml = parameters.copyState().createXml())
        copyXmlToBinary (*xml, destData);
}

void CoastsAudioProcessor::setStateInformation (const void* data, int sizeInBytes)
{
    if (auto xml = getXmlFromBinary (data, sizeInBytes))
        if (xml->hasTagName (parameters.state.getType()))
            parameters.replaceState (juce::ValueTree::fromXml (*xml));
}

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new CoastsAudioProcessor();
}
