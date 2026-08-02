#pragma once

#include <JuceHeader.h>

#include <atomic>
#include <memory>
#include <vector>

class VoxTermAudioProcessor final : public juce::AudioProcessor
{
public:
    VoxTermAudioProcessor();
    ~VoxTermAudioProcessor() override;

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
    double getTailLengthSeconds() const override { return 2.0; }

    int getNumPrograms() override { return 1; }
    int getCurrentProgram() override { return 0; }
    void setCurrentProgram (int) override {}
    const juce::String getProgramName (int) override { return {}; }
    void changeProgramName (int, const juce::String&) override {}

    void getStateInformation (juce::MemoryBlock& destData) override;
    void setStateInformation (const void* data, int sizeInBytes) override;

    static juce::AudioProcessorValueTreeState::ParameterLayout createParameterLayout();

    void setMessageText (const juce::String& text);
    juce::String getMessageText() const;
    void requestSpeechGeneration (bool auditionWhenReady);
    void requestPlayback();

    juce::String getRenderStatusText() const;
    float getOutputLevel() const noexcept { return outputLevel.load(); }
    int getActiveMidiNote() const noexcept { return activeMidiNote.load(); }

    juce::AudioProcessorValueTreeState parameters;
    juce::MidiKeyboardState keyboardState;

private:
    struct PreparedSpeech
    {
        std::vector<float> samples;
    };

    struct SharedRenderState
    {
        std::atomic<bool> alive { true };
        std::atomic<int> status { 0 };
        std::atomic<bool> auditionWhenReady { false };
        std::atomic<bool> playbackRequested { false };
        std::shared_ptr<const PreparedSpeech> speech;
    };

    static float parameterValue (const juce::AudioProcessorValueTreeState& state,
                                 const char* id) noexcept;
    static std::vector<float> resampleSpeech (const std::vector<float>& input,
                                             double sourceRate,
                                             double targetRate);

    void renderRange (juce::AudioBuffer<float>& buffer, int startSample, int numSamples);
    void handleMidiMessage (const juce::MidiMessage& message);
    void beginPlayback (bool fromMidi, int midiNote, float velocity);
    void stopPlayback();

    std::shared_ptr<SharedRenderState> sharedRenderState;
    std::atomic<double> currentSampleRate { 44100.0 };

    double playbackPosition = 0.0;
    bool playing = false;
    bool midiTriggered = false;
    bool noteHeld = false;
    float triggerVelocity = 1.0f;

    int holdCounter = 0;
    float heldSample = 0.0f;
    float filterState = 0.0f;
    float ringPhase = 0.0f;
    float driftPhase = 0.0f;
    juce::Random random;

    std::atomic<float> outputLevel { 0.0f };
    std::atomic<int> activeMidiNote { -1 };

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (VoxTermAudioProcessor)
};
