#pragma once

#include <JuceHeader.h>

#include <array>
#include <memory>

#include "PluginProcessor.h"

class VoxTermAudioProcessorEditor final : public juce::AudioProcessorEditor,
                                          private juce::Timer
{
public:
    explicit VoxTermAudioProcessorEditor (VoxTermAudioProcessor&);
    ~VoxTermAudioProcessorEditor() override;

    void paint (juce::Graphics&) override;
    void resized() override;

private:
    using SliderAttachment = juce::AudioProcessorValueTreeState::SliderAttachment;
    using ComboAttachment = juce::AudioProcessorValueTreeState::ComboBoxAttachment;

    void timerCallback() override;
    void configureSlider (juce::Slider&, const juce::String& name, int decimals = 2);
    void configureCombo (juce::ComboBox&, const juce::String& name,
                         const juce::StringArray& items);
    void drawControlLabel (juce::Graphics&, const juce::Component&) const;

    VoxTermAudioProcessor& processor;
    juce::LookAndFeel_V4 terminalLook;

    juce::TextEditor messageEditor;
    juce::TextButton transmitButton { "SYNTHESIZE + TRANSMIT" };
    juce::TextButton playButton { "REPLAY BUFFER" };
    juce::Label statusLabel;

    juce::ComboBox voiceBox;
    juce::ComboBox modeBox;

    juce::Slider speechRate;
    juce::Slider speechPitch;
    juce::Slider playbackRate;
    juce::Slider bitDepth;
    juce::Slider reduction;
    juce::Slider ringFrequency;
    juce::Slider ringMix;
    juce::Slider noise;
    juce::Slider cutoff;
    juce::Slider drive;
    juce::Slider drift;
    juce::Slider masterGain;

    juce::MidiKeyboardComponent keyboard;

    std::unique_ptr<ComboAttachment> voiceAttachment;
    std::unique_ptr<ComboAttachment> modeAttachment;
    std::unique_ptr<SliderAttachment> speechRateAttachment;
    std::unique_ptr<SliderAttachment> speechPitchAttachment;
    std::unique_ptr<SliderAttachment> playbackRateAttachment;
    std::unique_ptr<SliderAttachment> bitDepthAttachment;
    std::unique_ptr<SliderAttachment> reductionAttachment;
    std::unique_ptr<SliderAttachment> ringFrequencyAttachment;
    std::unique_ptr<SliderAttachment> ringMixAttachment;
    std::unique_ptr<SliderAttachment> noiseAttachment;
    std::unique_ptr<SliderAttachment> cutoffAttachment;
    std::unique_ptr<SliderAttachment> driveAttachment;
    std::unique_ptr<SliderAttachment> driftAttachment;
    std::unique_ptr<SliderAttachment> masterGainAttachment;

    std::array<juce::Component*, 14> controlSlots;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (VoxTermAudioProcessorEditor)
};
