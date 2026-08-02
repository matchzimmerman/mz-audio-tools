#include "PluginProcessor.h"
#include "PluginEditor.h"
#include "SpeechGenerator.h"

#include <cmath>

namespace
{
constexpr auto twoPi = juce::MathConstants<float>::twoPi;
}

VoxTermAudioProcessor::VoxTermAudioProcessor()
    : AudioProcessor (BusesProperties().withOutput ("Output", juce::AudioChannelSet::stereo(), true)),
      parameters (*this, nullptr, "VOXTERM_PARAMETERS", createParameterLayout()),
      sharedRenderState (std::make_shared<SharedRenderState>())
{
    if (! parameters.state.hasProperty ("message"))
        parameters.state.setProperty ("message", "TRANSMISSION CHANNEL OPEN.", nullptr);
}

VoxTermAudioProcessor::~VoxTermAudioProcessor()
{
    sharedRenderState->alive.store (false);
}

void VoxTermAudioProcessor::prepareToPlay (double sampleRate, int)
{
    currentSampleRate.store (sampleRate);
    playbackPosition = 0.0;
    playing = false;
    holdCounter = 0;
    heldSample = 0.0f;
    filterState = 0.0f;
    ringPhase = 0.0f;
    driftPhase = 0.0f;
    outputLevel.store (0.0f);
    activeMidiNote.store (-1);
}

void VoxTermAudioProcessor::releaseResources()
{
    stopPlayback();
}

bool VoxTermAudioProcessor::isBusesLayoutSupported (const BusesLayout& layouts) const
{
    const auto output = layouts.getMainOutputChannelSet();
    return output == juce::AudioChannelSet::mono()
        || output == juce::AudioChannelSet::stereo();
}

void VoxTermAudioProcessor::processBlock (juce::AudioBuffer<float>& buffer,
                                          juce::MidiBuffer& midiMessages)
{
    juce::ScopedNoDenormals noDenormals;
    buffer.clear();

    keyboardState.processNextMidiBuffer (midiMessages, 0, buffer.getNumSamples(), true);

    if (sharedRenderState->playbackRequested.exchange (false))
        beginPlayback (false, -1, 1.0f);

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

    outputLevel.store (juce::jmax (peak, outputLevel.load() * 0.86f));
}

void VoxTermAudioProcessor::renderRange (juce::AudioBuffer<float>& buffer,
                                         int startSample,
                                         int numSamples)
{
    if (numSamples <= 0 || ! playing)
        return;

    const auto speech = std::atomic_load (&sharedRenderState->speech);
    if (speech == nullptr || speech->samples.size() < 2)
    {
        stopPlayback();
        return;
    }

    auto* left = buffer.getWritePointer (0, startSample);
    auto* right = buffer.getNumChannels() > 1
        ? buffer.getWritePointer (1, startSample)
        : nullptr;

    const auto sampleRate = static_cast<float> (currentSampleRate.load());
    const auto playbackRate = parameterValue (parameters, "playbackRate");
    const auto drift = parameterValue (parameters, "drift");
    const auto reduction = juce::jmax (1, juce::roundToInt (parameterValue (parameters, "reduction")));
    const auto bits = juce::jlimit (4, 16, juce::roundToInt (parameterValue (parameters, "bitDepth")));
    const auto quantisationLevels = std::pow (2.0f, static_cast<float> (bits - 1));
    const auto ringFrequency = parameterValue (parameters, "ringFrequency");
    const auto ringMix = parameterValue (parameters, "ringMix");
    const auto noiseAmount = parameterValue (parameters, "noise");
    const auto cutoff = juce::jlimit (80.0f, sampleRate * 0.45f,
                                     parameterValue (parameters, "cutoff"));
    const auto filterPole = std::exp (-twoPi * cutoff / sampleRate);
    const auto drive = 1.0f + parameterValue (parameters, "drive") * 8.0f;
    const auto gain = juce::Decibels::decibelsToGain (
        parameterValue (parameters, "masterGain"));
    const auto playMode = juce::roundToInt (parameterValue (parameters, "playMode"));

    for (auto sampleIndex = 0; sampleIndex < numSamples; ++sampleIndex)
    {
        if (! playing)
            break;

        if (playbackPosition >= static_cast<double> (speech->samples.size() - 1))
        {
            if (playMode == 2 && midiTriggered && noteHeld)
                playbackPosition = std::fmod (playbackPosition,
                    static_cast<double> (speech->samples.size() - 1));
            else
            {
                stopPlayback();
                break;
            }
        }

        const auto index = static_cast<size_t> (playbackPosition);
        const auto fraction = static_cast<float> (playbackPosition - static_cast<double> (index));
        auto sample = juce::jmap (fraction,
                                 speech->samples[index],
                                 speech->samples[index + 1]);

        const auto driftModulation = std::sin (twoPi * driftPhase) * drift * 0.035f;
        playbackPosition += playbackRate * (1.0 + static_cast<double> (driftModulation));
        driftPhase += (0.17f + drift * 0.63f) / sampleRate;
        if (driftPhase >= 1.0f)
            driftPhase -= 1.0f;

        if (holdCounter <= 0)
        {
            heldSample = sample;
            holdCounter = reduction - 1;
        }
        else
        {
            --holdCounter;
        }
        sample = heldSample;

        sample = std::round (sample * quantisationLevels) / quantisationLevels;

        const auto ring = std::sin (twoPi * ringPhase);
        sample = sample * (1.0f - ringMix) + sample * ring * ringMix;
        ringPhase += ringFrequency / sampleRate;
        ringPhase -= std::floor (ringPhase);

        sample += (random.nextFloat() * 2.0f - 1.0f) * noiseAmount;
        filterState = sample * (1.0f - filterPole) + filterState * filterPole;
        sample = std::tanh (filterState * drive) / std::tanh (drive);
        sample *= gain * triggerVelocity;

        left[sampleIndex] = sample;
        if (right != nullptr)
            right[sampleIndex] = sample;
    }
}

void VoxTermAudioProcessor::handleMidiMessage (const juce::MidiMessage& message)
{
    if (message.isNoteOn())
    {
        beginPlayback (true, message.getNoteNumber(), message.getFloatVelocity());
        return;
    }

    if (message.isNoteOff())
    {
        if (message.getNoteNumber() == activeMidiNote.load())
        {
            noteHeld = false;
            const auto playMode = juce::roundToInt (parameterValue (parameters, "playMode"));
            if (playMode != 0)
                stopPlayback();
        }
        return;
    }

    if (message.isAllNotesOff() || message.isAllSoundOff())
        stopPlayback();
}

void VoxTermAudioProcessor::beginPlayback (bool fromMidi, int midiNote, float velocity)
{
    const auto speech = std::atomic_load (&sharedRenderState->speech);
    if (speech == nullptr || speech->samples.size() < 2)
        return;

    playbackPosition = 0.0;
    playing = true;
    midiTriggered = fromMidi;
    noteHeld = fromMidi;
    triggerVelocity = juce::jlimit (0.05f, 1.0f, velocity);
    holdCounter = 0;
    filterState = 0.0f;
    activeMidiNote.store (fromMidi ? midiNote : -1);
}

void VoxTermAudioProcessor::stopPlayback()
{
    playing = false;
    midiTriggered = false;
    noteHeld = false;
    playbackPosition = 0.0;
    activeMidiNote.store (-1);
}

void VoxTermAudioProcessor::setMessageText (const juce::String& text)
{
    parameters.state.setProperty ("message", text.substring (0, 512), nullptr);
}

juce::String VoxTermAudioProcessor::getMessageText() const
{
    return parameters.state.getProperty ("message", "TRANSMISSION CHANNEL OPEN.").toString();
}

void VoxTermAudioProcessor::requestSpeechGeneration (bool auditionWhenReady)
{
    const auto phrase = getMessageText().trim();
    if (phrase.isEmpty())
    {
        sharedRenderState->status.store (3);
        return;
    }

    sharedRenderState->status.store (1);
    sharedRenderState->auditionWhenReady.store (auditionWhenReady);

    const auto targetRate = currentSampleRate.load();
    const auto voiceRate = parameterValue (parameters, "speechRate");
    const auto voicePitch = parameterValue (parameters, "speechPitch");
    const auto voiceIndex = juce::roundToInt (parameterValue (parameters, "voice"));
    const auto state = sharedRenderState;

    voxterm::renderSpeechAsync (phrase.toStdString(), voiceRate, voicePitch, voiceIndex,
        [state, targetRate] (voxterm::SpeechRender&& render)
        {
            if (! state->alive.load())
                return;

            auto prepared = std::make_shared<PreparedSpeech>();
            prepared->samples = resampleSpeech (render.samples, render.sampleRate, targetRate);

            if (prepared->samples.size() < 2)
            {
                state->status.store (3);
                return;
            }

            std::atomic_store (&state->speech,
                               std::shared_ptr<const PreparedSpeech> (prepared));
            state->status.store (2);

            if (state->auditionWhenReady.exchange (false))
                state->playbackRequested.store (true);
        });
}

void VoxTermAudioProcessor::requestPlayback()
{
    const auto speech = std::atomic_load (&sharedRenderState->speech);
    if (speech == nullptr || speech->samples.size() < 2)
        requestSpeechGeneration (true);
    else
        sharedRenderState->playbackRequested.store (true);
}

juce::String VoxTermAudioProcessor::getRenderStatusText() const
{
    switch (sharedRenderState->status.load())
    {
        case 1:  return "SYNTHESIZING TRANSMISSION...";
        case 2:  return "VOICE BUFFER READY // MIDI ARMED";
        case 3:  return "VOICE GENERATION ERROR";
        case 0:
        default: return "AWAITING TRANSMISSION";
    }
}

float VoxTermAudioProcessor::parameterValue (
    const juce::AudioProcessorValueTreeState& state,
    const char* id) noexcept
{
    return state.getRawParameterValue (id)->load();
}

std::vector<float> VoxTermAudioProcessor::resampleSpeech (
    const std::vector<float>& input,
    double sourceRate,
    double targetRate)
{
    if (input.size() < 2 || sourceRate <= 0.0 || targetRate <= 0.0)
        return {};

    if (std::abs (sourceRate - targetRate) < 1.0)
        return input;

    const auto outputSize = static_cast<size_t> (std::ceil (
        static_cast<double> (input.size()) * targetRate / sourceRate));
    std::vector<float> output (juce::jmax (static_cast<size_t> (2), outputSize));
    const auto sourceStep = sourceRate / targetRate;

    for (size_t i = 0; i < output.size(); ++i)
    {
        const auto position = static_cast<double> (i) * sourceStep;
        const auto index = juce::jmin (input.size() - 2,
                                      static_cast<size_t> (position));
        const auto fraction = static_cast<float> (position - static_cast<double> (index));
        output[i] = juce::jmap (fraction, input[index], input[index + 1]);
    }

    return output;
}

juce::AudioProcessorValueTreeState::ParameterLayout
VoxTermAudioProcessor::createParameterLayout()
{
    using ID = juce::ParameterID;
    using Range = juce::NormalisableRange<float>;

    std::vector<std::unique_ptr<juce::RangedAudioParameter>> layout;

    layout.push_back (std::make_unique<juce::AudioParameterChoice> (
        ID { "voice", 1 }, "Terminal Voice",
        juce::StringArray { "Mainframe", "Orbital", "Service", "Archive" }, 0));
    layout.push_back (std::make_unique<juce::AudioParameterFloat> (
        ID { "speechRate", 1 }, "Speech Rate", Range { 0.0f, 1.0f, 0.001f }, 0.34f));
    layout.push_back (std::make_unique<juce::AudioParameterFloat> (
        ID { "speechPitch", 1 }, "Speech Pitch", Range { 0.5f, 2.0f, 0.001f }, 0.82f));
    layout.push_back (std::make_unique<juce::AudioParameterFloat> (
        ID { "playbackRate", 1 }, "Playback Rate", Range { 0.5f, 2.0f, 0.001f }, 0.92f));
    layout.push_back (std::make_unique<juce::AudioParameterChoice> (
        ID { "playMode", 1 }, "Playback Mode",
        juce::StringArray { "One Shot", "Gate", "Loop" }, 0));

    layout.push_back (std::make_unique<juce::AudioParameterFloat> (
        ID { "bitDepth", 1 }, "Bit Depth", Range { 4.0f, 16.0f, 1.0f }, 9.0f));
    layout.push_back (std::make_unique<juce::AudioParameterFloat> (
        ID { "reduction", 1 }, "Sample Hold", Range { 1.0f, 32.0f, 1.0f }, 3.0f));
    layout.push_back (std::make_unique<juce::AudioParameterFloat> (
        ID { "ringFrequency", 1 }, "Carrier Frequency",
        Range { 0.0f, 2000.0f, 0.1f, 0.45f }, 94.0f));
    layout.push_back (std::make_unique<juce::AudioParameterFloat> (
        ID { "ringMix", 1 }, "Carrier Mix", Range { 0.0f, 1.0f, 0.001f }, 0.32f));
    layout.push_back (std::make_unique<juce::AudioParameterFloat> (
        ID { "noise", 1 }, "Transmission Noise", Range { 0.0f, 0.2f, 0.0001f }, 0.018f));
    layout.push_back (std::make_unique<juce::AudioParameterFloat> (
        ID { "cutoff", 1 }, "Terminal Filter",
        Range { 180.0f, 16000.0f, 1.0f, 0.35f }, 5200.0f));
    layout.push_back (std::make_unique<juce::AudioParameterFloat> (
        ID { "drive", 1 }, "Machine Drive", Range { 0.0f, 1.0f, 0.001f }, 0.38f));
    layout.push_back (std::make_unique<juce::AudioParameterFloat> (
        ID { "drift", 1 }, "Voltage Drift", Range { 0.0f, 1.0f, 0.001f }, 0.18f));
    layout.push_back (std::make_unique<juce::AudioParameterFloat> (
        ID { "masterGain", 1 }, "Output", Range { -36.0f, 6.0f, 0.1f }, -7.0f));

    return { layout.begin(), layout.end() };
}

void VoxTermAudioProcessor::getStateInformation (juce::MemoryBlock& destData)
{
    if (auto xml = parameters.copyState().createXml())
        copyXmlToBinary (*xml, destData);
}

void VoxTermAudioProcessor::setStateInformation (const void* data, int sizeInBytes)
{
    if (auto xml = getXmlFromBinary (data, sizeInBytes))
        if (xml->hasTagName (parameters.state.getType()))
            parameters.replaceState (juce::ValueTree::fromXml (*xml));
}

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new VoxTermAudioProcessor();
}
