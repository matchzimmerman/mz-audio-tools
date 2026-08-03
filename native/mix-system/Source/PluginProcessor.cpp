#include "PluginProcessor.h"
#include "PluginEditor.h"

MZMixSystemAudioProcessor::MZMixSystemAudioProcessor()
    : AudioProcessor (BusesProperties()
                          .withInput ("Input", juce::AudioChannelSet::stereo(), true)
                          .withOutput ("Output", juce::AudioChannelSet::stereo(), true)),
      parameters (*this, nullptr, "MZ_MIX_SYSTEM", createParameterLayout()),
      registrySlot (mz::SharedMixRegistry::instance().registerInstance())
{
}

MZMixSystemAudioProcessor::~MZMixSystemAudioProcessor()
{
    mz::SharedMixRegistry::instance().unregisterInstance (registrySlot);
}

void MZMixSystemAudioProcessor::prepareToPlay (double sampleRate, int samplesPerBlock)
{
    roleDsp.prepare (sampleRate, samplesPerBlock);
}

void MZMixSystemAudioProcessor::releaseResources()
{
    roleDsp.reset();
    const mz::SpectralValues emptyBands {};
    mz::SharedMixRegistry::instance().publishNode (registrySlot,
                                                   false,
                                                   currentRole(),
                                                   currentImportance(),
                                                   0.0f,
                                                   0.0f,
                                                   1.0f,
                                                   0.0f,
                                                   emptyBands,
                                                   emptyBands);
}

bool MZMixSystemAudioProcessor::isBusesLayoutSupported (const BusesLayout& layouts) const
{
    const auto input = layouts.getMainInputChannelSet();
    const auto output = layouts.getMainOutputChannelSet();
    return input == output && (output == juce::AudioChannelSet::mono()
                               || output == juce::AudioChannelSet::stereo());
}

float MZMixSystemAudioProcessor::blockRms (const juce::AudioBuffer<float>& buffer) noexcept
{
    if (buffer.getNumSamples() == 0 || buffer.getNumChannels() == 0)
        return 0.0f;

    float sum = 0.0f;
    const auto channels = juce::jmin (2, buffer.getNumChannels());
    for (int channel = 0; channel < channels; ++channel)
    {
        const auto value = buffer.getRMSLevel (channel, 0, buffer.getNumSamples());
        sum += value * value;
    }

    return std::sqrt (sum / static_cast<float> (channels));
}

void MZMixSystemAudioProcessor::processBlock (juce::AudioBuffer<float>& buffer,
                                              juce::MidiBuffer& midi)
{
    juce::ScopedNoDenormals noDenormals;
    juce::ignoreUnused (midi);

    for (int channel = getTotalNumInputChannels(); channel < getTotalNumOutputChannels(); ++channel)
        buffer.clear (channel, 0, buffer.getNumSamples());

    const auto rms = blockRms (buffer);
    inputRms.store (rms, std::memory_order_relaxed);

    auto& registry = mz::SharedMixRegistry::instance();

    if (isConductorMode())
    {
        const auto strength = parameters.getRawParameterValue ("globalAuto")->load() * 0.01f;
        const mz::SpectralValues emptyBands {};
        registry.setGlobalStrength (strength);
        registry.publishNode (registrySlot,
                              false,
                              currentRole(),
                              currentImportance(),
                              0.0f,
                              0.0f,
                              1.0f,
                              0.0f,
                              emptyBands,
                              emptyBands);
        return;
    }

    const auto role = currentRole();
    const auto importance = currentImportance();
    const auto spectrum = roleDsp.analyse (buffer);
    const auto yieldRequest = registry.calculateYield (registrySlot, role, importance);
    const auto spectralYield = registry.calculateSpectralYield (registrySlot, role, importance);

    mz::RoleDsp::Settings settings;
    settings.role = role;
    settings.autoMode = juce::roundToInt (parameters.getRawParameterValue ("autoMode")->load());
    settings.widthPolicy = juce::roundToInt (parameters.getRawParameterValue ("widthPolicy")->load());
    settings.monoPolicy = juce::roundToInt (parameters.getRawParameterValue ("monoPolicy")->load());
    settings.density = juce::roundToInt (parameters.getRawParameterValue ("density")->load());
    settings.outputTrimDb = parameters.getRawParameterValue ("outputTrim")->load();
    settings.yieldRequest = yieldRequest;
    settings.spectralYield = spectralYield;
    settings.spectralDepth = parameters.getRawParameterValue ("spectralDepth")->load() * 0.01f;
    settings.globalStrength = registry.getGlobalStrength();

    roleDsp.process (buffer, settings);

    registry.publishNode (registrySlot,
                          true,
                          role,
                          importance,
                          rms,
                          roleDsp.getCurrentDuckDb(),
                          roleDsp.getEffectiveWidth(),
                          roleDsp.getEffectiveMonoHz(),
                          spectrum,
                          roleDsp.getSpectralReductionDb());
}

juce::AudioProcessorEditor* MZMixSystemAudioProcessor::createEditor()
{
    return new MZMixSystemAudioProcessorEditor (*this);
}

void MZMixSystemAudioProcessor::getStateInformation (juce::MemoryBlock& destData)
{
    if (const auto xml = parameters.copyState().createXml())
        copyXmlToBinary (*xml, destData);
}

void MZMixSystemAudioProcessor::setStateInformation (const void* data, int sizeInBytes)
{
    if (const auto xml = getXmlFromBinary (data, sizeInBytes))
        if (xml->hasTagName (parameters.state.getType()))
            parameters.replaceState (juce::ValueTree::fromXml (*xml));
}

juce::AudioProcessorValueTreeState::ParameterLayout MZMixSystemAudioProcessor::createParameterLayout()
{
    using Parameter = std::unique_ptr<juce::RangedAudioParameter>;
    std::vector<Parameter> layout;

    layout.push_back (std::make_unique<juce::AudioParameterChoice> (
        juce::ParameterID { "mode", 1 }, "Mode",
        juce::StringArray { "NODE", "CONDUCTOR" }, 0));

    layout.push_back (std::make_unique<juce::AudioParameterChoice> (
        juce::ParameterID { "role", 1 }, "Role",
        juce::StringArray { "FOUNDATION", "RHYTHM", "BODY", "FOCUS", "AIR" }, 2));

    layout.push_back (std::make_unique<juce::AudioParameterInt> (
        juce::ParameterID { "importance", 1 }, "Importance", 1, 5, 3));

    layout.push_back (std::make_unique<juce::AudioParameterChoice> (
        juce::ParameterID { "autoMode", 1 }, "Auto Mix",
        juce::StringArray { "OFF", "GENTLE", "FIRM" }, 1));

    layout.push_back (std::make_unique<juce::AudioParameterChoice> (
        juce::ParameterID { "widthPolicy", 1 }, "Width",
        juce::StringArray { "AUTO", "NARROW", "BALANCED", "WIDE" }, 0));

    layout.push_back (std::make_unique<juce::AudioParameterChoice> (
        juce::ParameterID { "monoPolicy", 1 }, "Mono Protect",
        juce::StringArray { "AUTO", "OFF", "60 HZ", "90 HZ", "120 HZ", "150 HZ", "200 HZ" }, 0));

    layout.push_back (std::make_unique<juce::AudioParameterChoice> (
        juce::ParameterID { "density", 1 }, "Density",
        juce::StringArray { "SPARSE", "NORMAL", "FULL" }, 1));

    layout.push_back (std::make_unique<juce::AudioParameterFloat> (
        juce::ParameterID { "spectralDepth", 1 }, "Spectral Negotiation",
        juce::NormalisableRange<float> { 0.0f, 100.0f, 1.0f }, 70.0f,
        juce::AudioParameterFloatAttributes().withLabel ("%")));

    layout.push_back (std::make_unique<juce::AudioParameterFloat> (
        juce::ParameterID { "outputTrim", 1 }, "Output Trim",
        juce::NormalisableRange<float> { -12.0f, 12.0f, 0.1f }, 0.0f,
        juce::AudioParameterFloatAttributes().withLabel ("dB")));

    layout.push_back (std::make_unique<juce::AudioParameterFloat> (
        juce::ParameterID { "globalAuto", 1 }, "Global Auto Strength",
        juce::NormalisableRange<float> { 0.0f, 100.0f, 1.0f }, 65.0f,
        juce::AudioParameterFloatAttributes().withLabel ("%")));

    return { layout.begin(), layout.end() };
}

bool MZMixSystemAudioProcessor::isConductorMode() const noexcept
{
    return juce::roundToInt (parameters.getRawParameterValue ("mode")->load()) == 1;
}

mz::MixRole MZMixSystemAudioProcessor::currentRole() const noexcept
{
    return mz::roleFromIndex (juce::roundToInt (parameters.getRawParameterValue ("role")->load()));
}

int MZMixSystemAudioProcessor::currentImportance() const noexcept
{
    return juce::jlimit (1, 5,
                         juce::roundToInt (parameters.getRawParameterValue ("importance")->load()));
}

float MZMixSystemAudioProcessor::getGlobalStrength() const noexcept
{
    return mz::SharedMixRegistry::instance().getGlobalStrength();
}

std::vector<mz::SharedMixRegistry::Snapshot> MZMixSystemAudioProcessor::getNodeSnapshots() const
{
    return mz::SharedMixRegistry::instance().snapshots();
}

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new MZMixSystemAudioProcessor();
}
