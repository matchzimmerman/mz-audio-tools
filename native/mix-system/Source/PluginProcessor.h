#pragma once

#include <JuceHeader.h>
#include "RoleDsp.h"
#include "SharedMixRegistry.h"

class MZMixSystemAudioProcessor final : public juce::AudioProcessor
{
public:
    MZMixSystemAudioProcessor();
    ~MZMixSystemAudioProcessor() override;

    void prepareToPlay (double sampleRate, int samplesPerBlock) override;
    void releaseResources() override;
    bool isBusesLayoutSupported (const BusesLayout& layouts) const override;
    void processBlock (juce::AudioBuffer<float>&, juce::MidiBuffer&) override;

    juce::AudioProcessorEditor* createEditor() override;
    bool hasEditor() const override { return true; }

    const juce::String getName() const override { return JucePlugin_Name; }
    bool acceptsMidi() const override { return false; }
    bool producesMidi() const override { return false; }
    bool isMidiEffect() const override { return false; }
    double getTailLengthSeconds() const override { return 0.0; }

    int getNumPrograms() override { return 1; }
    int getCurrentProgram() override { return 0; }
    void setCurrentProgram (int) override {}
    const juce::String getProgramName (int) override { return {}; }
    void changeProgramName (int, const juce::String&) override {}

    void getStateInformation (juce::MemoryBlock& destData) override;
    void setStateInformation (const void* data, int sizeInBytes) override;

    static juce::AudioProcessorValueTreeState::ParameterLayout createParameterLayout();

    juce::AudioProcessorValueTreeState parameters;

    bool isConductorMode() const noexcept;
    mz::MixRole currentRole() const noexcept;
    int currentImportance() const noexcept;
    int getRegistrySlot() const noexcept { return registrySlot; }

    float getInputRms() const noexcept { return inputRms.load(); }
    float getCurrentDuckDb() const noexcept { return roleDsp.getCurrentDuckDb(); }
    float getEffectiveWidth() const noexcept { return roleDsp.getEffectiveWidth(); }
    float getEffectiveMonoHz() const noexcept { return roleDsp.getEffectiveMonoHz(); }
    float getGlobalStrength() const noexcept;

    std::vector<mz::SharedMixRegistry::Snapshot> getNodeSnapshots() const;

private:
    static float blockRms (const juce::AudioBuffer<float>& buffer) noexcept;

    mz::RoleDsp roleDsp;
    int registrySlot = -1;
    std::atomic<float> inputRms { 0.0f };

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (MZMixSystemAudioProcessor)
};
