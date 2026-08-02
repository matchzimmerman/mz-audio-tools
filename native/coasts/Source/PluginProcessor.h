#pragma once

#include <JuceHeader.h>
#include <atomic>

class CoastsAudioProcessor final : public juce::AudioProcessor
{
public:
    CoastsAudioProcessor();
    ~CoastsAudioProcessor() override = default;

    void prepareToPlay (double sampleRate, int samplesPerBlock) override;
    void releaseResources() override;
    bool isBusesLayoutSupported (const BusesLayout& layouts) const override;
    void processBlock (juce::AudioBuffer<float>&, juce::MidiBuffer&) override;

    juce::AudioProcessorEditor* createEditor() override;
    bool hasEditor() const override { return true; }

    const juce::String getName() const override { return JucePlugin_Name; }
    bool acceptsMidi() const override { return true; }
    bool producesMidi() const override { return false; }
    bool isMidiEffect() const override { return false; }
    double getTailLengthSeconds() const override { return 3.5; }

    int getNumPrograms() override { return 1; }
    int getCurrentProgram() override { return 0; }
    void setCurrentProgram (int) override {}
    const juce::String getProgramName (int) override { return {}; }
    void changeProgramName (int, const juce::String&) override {}

    void getStateInformation (juce::MemoryBlock& destData) override;
    void setStateInformation (const void* data, int sizeInBytes) override;

    static juce::AudioProcessorValueTreeState::ParameterLayout createParameterLayout();

    juce::AudioProcessorValueTreeState parameters;

    float getOutputLevel() const noexcept { return outputLevel.load(); }
    int getActiveMidiNote() const noexcept { return activeMidiNote.load(); }

private:
    enum class WestStage { idle, rise, fall, release };

    void renderRange (juce::AudioBuffer<float>& buffer, int startSample, int numSamples);
    void handleMidiMessage (const juce::MidiMessage& message);
    void noteOn (int midiNote, float velocity);
    void noteOff (int midiNote);
    void allNotesOff();

    float renderEastSample();
    float renderWestSample();
    float renderOscillator (float phase, int waveform) const noexcept;
    float cutoffFromControl (float value) const noexcept;
    float timeFromControl (float value, float minimum, float maximum) const noexcept;
    float wrapPhase (float phase) const noexcept;
    void updateEnvelopeParameters();

    double currentSampleRate = 44100.0;
    int lastMode = 0;
    int currentNote = -1;
    float currentVelocity = 0.5f;
    bool keyDown = false;

    float eastPhase1 = 0.0f;
    float eastPhase2 = 0.0f;
    juce::ADSR eastAmpEnvelope;
    juce::ADSR eastFilterEnvelope;
    juce::dsp::StateVariableTPTFilter<float> eastFilter1;
    juce::dsp::StateVariableTPTFilter<float> eastFilter2;

    float westCarrierPhase = 0.0f;
    float westModPhase = 0.0f;
    float westEnvelope = 0.0f;
    float westPitchOffsetCents = 0.0f;
    float westFoldOffset = 0.0f;
    WestStage westStage = WestStage::idle;
    juce::dsp::StateVariableTPTFilter<float> westLowPassGate;
    juce::Random random;

    juce::SmoothedValue<float> masterGain;
    std::atomic<float> outputLevel { 0.0f };
    std::atomic<int> activeMidiNote { -1 };

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (CoastsAudioProcessor)
};
