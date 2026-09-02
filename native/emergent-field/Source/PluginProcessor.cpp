#include "PluginProcessor.h"
#include "PluginEditor.h"

MZEmergentFieldAudioProcessor::MZEmergentFieldAudioProcessor()
    : AudioProcessor (BusesProperties()
                          .withOutput ("Output", juce::AudioChannelSet::stereo(), true)),
      parameters (*this, nullptr, "MZ_EMERGENT_FIELD", createParameterLayout())
{
}

void MZEmergentFieldAudioProcessor::prepareToPlay (double sampleRate, int samplesPerBlock)
{
    engine.prepare (sampleRate, samplesPerBlock);
    wasRunning = false;
}

void MZEmergentFieldAudioProcessor::releaseResources()
{
    engine.reset();
    wasRunning = false;
}

bool MZEmergentFieldAudioProcessor::isBusesLayoutSupported (const BusesLayout& layouts) const
{
    return layouts.getMainInputChannelSet().isDisabled()
           && layouts.getMainOutputChannelSet() == juce::AudioChannelSet::stereo();
}

void MZEmergentFieldAudioProcessor::processBlock (juce::AudioBuffer<float>& buffer,
                                                  juce::MidiBuffer& midi)
{
    juce::ScopedNoDenormals noDenormals;
    juce::ignoreUnused (midi);

    double bpm = 96.0;
    bool hostTransportKnown = false;
    bool hostRunning = true;

    if (auto* playHead = getPlayHead())
    {
        if (const auto position = playHead->getPosition())
        {
            hostTransportKnown = true;
            if (const auto positionBpm = position->getBpm())
                bpm = *positionBpm;
            hostRunning = position->getIsPlaying();
        }
    }

    mz::GenerativeEngine::Settings settings;
    settings.density = parameters.getRawParameterValue ("density")->load() * 0.01f;
    settings.entropy = parameters.getRawParameterValue ("entropy")->load() * 0.01f;
    settings.energy = parameters.getRawParameterValue ("energy")->load() * 0.01f;
    settings.motion = parameters.getRawParameterValue ("motion")->load() * 0.01f;
    settings.spread = parameters.getRawParameterValue ("spread")->load() * 0.01f;
    settings.selfMix = parameters.getRawParameterValue ("selfMix")->load() * 0.01f;
    settings.space = parameters.getRawParameterValue ("space")->load() * 0.01f;
    settings.outputDb = parameters.getRawParameterValue ("output")->load();
    settings.root = juce::roundToInt (parameters.getRawParameterValue ("root")->load());
    settings.mode = juce::roundToInt (parameters.getRawParameterValue ("mode")->load());

    const auto freeRunning = juce::roundToInt (
        parameters.getRawParameterValue ("clock")->load()) == 1;
    settings.running = freeRunning || ! hostTransportKnown || hostRunning;

    if (settings.running && ! wasRunning)
        engine.requestMutation();

    wasRunning = settings.running;
    engine.process (buffer, settings, bpm);
}

juce::AudioProcessorEditor* MZEmergentFieldAudioProcessor::createEditor()
{
    return new MZEmergentFieldAudioProcessorEditor (*this);
}

void MZEmergentFieldAudioProcessor::getStateInformation (juce::MemoryBlock& destData)
{
    if (const auto xml = parameters.copyState().createXml())
        copyXmlToBinary (*xml, destData);
}

void MZEmergentFieldAudioProcessor::setStateInformation (const void* data, int sizeInBytes)
{
    if (const auto xml = getXmlFromBinary (data, sizeInBytes))
        if (xml->hasTagName (parameters.state.getType()))
            parameters.replaceState (juce::ValueTree::fromXml (*xml));
}

juce::AudioProcessorValueTreeState::ParameterLayout
MZEmergentFieldAudioProcessor::createParameterLayout()
{
    using Parameter = std::unique_ptr<juce::RangedAudioParameter>;
    std::vector<Parameter> layout;

    const auto percentRange = juce::NormalisableRange<float> { 0.0f, 100.0f, 1.0f };
    const auto percentAttributes = juce::AudioParameterFloatAttributes().withLabel ("%");

    layout.push_back (std::make_unique<juce::AudioParameterFloat> (
        juce::ParameterID { "density", 1 }, "Density", percentRange, 54.0f, percentAttributes));
    layout.push_back (std::make_unique<juce::AudioParameterFloat> (
        juce::ParameterID { "entropy", 1 }, "Entropy", percentRange, 46.0f, percentAttributes));
    layout.push_back (std::make_unique<juce::AudioParameterFloat> (
        juce::ParameterID { "energy", 1 }, "Energy", percentRange, 58.0f, percentAttributes));
    layout.push_back (std::make_unique<juce::AudioParameterFloat> (
        juce::ParameterID { "motion", 1 }, "Motion", percentRange, 44.0f, percentAttributes));
    layout.push_back (std::make_unique<juce::AudioParameterFloat> (
        juce::ParameterID { "spread", 1 }, "Spread", percentRange, 78.0f, percentAttributes));
    layout.push_back (std::make_unique<juce::AudioParameterFloat> (
        juce::ParameterID { "selfMix", 1 }, "Self Mix", percentRange, 82.0f, percentAttributes));
    layout.push_back (std::make_unique<juce::AudioParameterFloat> (
        juce::ParameterID { "space", 1 }, "Space", percentRange, 31.0f, percentAttributes));

    layout.push_back (std::make_unique<juce::AudioParameterFloat> (
        juce::ParameterID { "output", 1 }, "Output",
        juce::NormalisableRange<float> { -18.0f, 6.0f, 0.1f }, -4.0f,
        juce::AudioParameterFloatAttributes().withLabel ("dB")));

    layout.push_back (std::make_unique<juce::AudioParameterChoice> (
        juce::ParameterID { "root", 1 }, "Root",
        juce::StringArray { "C", "C#", "D", "D#", "E", "F",
                            "F#", "G", "G#", "A", "A#", "B" },
        0));

    layout.push_back (std::make_unique<juce::AudioParameterChoice> (
        juce::ParameterID { "mode", 1 }, "Mode",
        juce::StringArray { "DORIAN", "AEOLIAN", "MINOR PENT", "MAJOR PENT", "OPEN" },
        0));

    layout.push_back (std::make_unique<juce::AudioParameterChoice> (
        juce::ParameterID { "clock", 1 }, "Clock",
        juce::StringArray { "HOST", "FREE" },
        0));

    return { layout.begin(), layout.end() };
}

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new MZEmergentFieldAudioProcessor();
}
