#pragma once

#include <JuceHeader.h>
#include <array>
#include <atomic>

class SonarAudioProcessor final : public juce::AudioProcessor
{
public:
    SonarAudioProcessor();
    ~SonarAudioProcessor() override = default;

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
    double getTailLengthSeconds() const override { return 4.0; }

    int getNumPrograms() override { return 1; }
    int getCurrentProgram() override { return 0; }
    void setCurrentProgram (int) override {}
    const juce::String getProgramName (int) override { return {}; }
    void changeProgramName (int, const juce::String&) override {}

    void getStateInformation (juce::MemoryBlock& destData) override;
    void setStateInformation (const void* data, int sizeInBytes) override;

    static juce::AudioProcessorValueTreeState::ParameterLayout createParameterLayout();

    juce::AudioProcessorValueTreeState parameters;

    float getSweepPhase() const noexcept { return sweepPhase.load(); }
    float getObjectAngle() const noexcept { return objectAngle.load(); }
    float getObjectDistance() const noexcept { return objectDistance.load(); }
    float getEncounterPulse() const noexcept { return encounterPulse.load(); }
    int getCurrentStep() const noexcept { return currentStep.load(); }
    bool getTransportRunning() const noexcept { return transportRunning.load(); }

private:
    static float parameterValue (const juce::AudioProcessorValueTreeState& state,
                                 const char* id) noexcept;
    static float wrapUnit (float value) noexcept;
    static float shortestTurn (float from, float to) noexcept;
    static float ringToDistance (int ring) noexcept;
    static juce::String stepParameterId (int index);

    void updateTransport (int numSamples);
    void updateSpatialTarget();
    void configureSpaceProcessors (float distance, float rearAmount, float spaceAmount);

    double currentSampleRate = 44100.0;
    double internalPpq = 0.0;
    double blockPpq = 0.0;
    double ppqPerSample = 0.0;
    double beatsPerCycle = 4.0;
    double currentBpm = 120.0;
    bool hostPositionAvailable = false;
    bool blockIsPlaying = false;

    float currentAngleValue = 0.0f;
    float targetAngleValue = 0.0f;
    float currentDistanceValue = 0.25f;
    float targetDistanceValue = 0.25f;
    int lastSequenceStep = -1;
    float pulseValue = 0.0f;

    juce::AudioBuffer<float> dryBuffer;
    juce::AudioBuffer<float> wetBuffer;
    juce::AudioBuffer<float> reverbBuffer;

    juce::dsp::StateVariableTPTFilter<float> lowPassLeft;
    juce::dsp::StateVariableTPTFilter<float> lowPassRight;
    juce::dsp::Compressor<float> compressor;
    juce::Reverb reverb;
    juce::dsp::DelayLine<float, juce::dsp::DelayLineInterpolationTypes::Linear> reflectionLeft { 96000 };
    juce::dsp::DelayLine<float, juce::dsp::DelayLineInterpolationTypes::Linear> reflectionRight { 96000 };

    juce::SmoothedValue<float> inputGain;
    juce::SmoothedValue<float> outputGain;
    juce::SmoothedValue<float> dryWet;

    std::atomic<float> sweepPhase { 0.0f };
    std::atomic<float> objectAngle { 0.0f };
    std::atomic<float> objectDistance { 0.25f };
    std::atomic<float> encounterPulse { 0.0f };
    std::atomic<int> currentStep { 0 };
    std::atomic<bool> transportRunning { false };

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (SonarAudioProcessor)
};
