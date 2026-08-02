#pragma once

#include <JuceHeader.h>
#include "PluginProcessor.h"

class MZMixSystemAudioProcessorEditor final : public juce::AudioProcessorEditor,
                                              private juce::Timer
{
public:
    explicit MZMixSystemAudioProcessorEditor (MZMixSystemAudioProcessor&);
    ~MZMixSystemAudioProcessorEditor() override;

    void paint (juce::Graphics&) override;
    void resized() override;

private:
    using ComboAttachment = juce::AudioProcessorValueTreeState::ComboBoxAttachment;
    using SliderAttachment = juce::AudioProcessorValueTreeState::SliderAttachment;

    void timerCallback() override;
    void configureCombo (juce::ComboBox&, const juce::StringArray& items);
    void configureSlider (juce::Slider&, const juce::String& suffix, int decimals);
    void updateModeVisibility();
    void drawHeader (juce::Graphics&);
    void drawNodePanel (juce::Graphics&);
    void drawConductorPanel (juce::Graphics&);
    void drawLevelMeter (juce::Graphics&, juce::Rectangle<float> area, float rms);

    MZMixSystemAudioProcessor& processor;
    juce::LookAndFeel_V4 look;

    juce::ComboBox modeBox;
    juce::ComboBox roleBox;
    juce::ComboBox autoBox;
    juce::ComboBox widthBox;
    juce::ComboBox monoBox;
    juce::ComboBox densityBox;
    juce::Slider importanceSlider;
    juce::Slider outputTrimSlider;
    juce::Slider globalAutoSlider;

    std::unique_ptr<ComboAttachment> modeAttachment;
    std::unique_ptr<ComboAttachment> roleAttachment;
    std::unique_ptr<ComboAttachment> autoAttachment;
    std::unique_ptr<ComboAttachment> widthAttachment;
    std::unique_ptr<ComboAttachment> monoAttachment;
    std::unique_ptr<ComboAttachment> densityAttachment;
    std::unique_ptr<SliderAttachment> importanceAttachment;
    std::unique_ptr<SliderAttachment> outputTrimAttachment;
    std::unique_ptr<SliderAttachment> globalAutoAttachment;

    bool previousConductorState = false;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (MZMixSystemAudioProcessorEditor)
};
