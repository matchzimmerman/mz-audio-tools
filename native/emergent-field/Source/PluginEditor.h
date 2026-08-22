#pragma once

#include <JuceHeader.h>

#include "PluginProcessor.h"

class MZEmergentFieldAudioProcessorEditor final : public juce::AudioProcessorEditor,
                                                  private juce::Timer
{
public:
    explicit MZEmergentFieldAudioProcessorEditor (MZEmergentFieldAudioProcessor&);
    ~MZEmergentFieldAudioProcessorEditor() override;

    void paint (juce::Graphics&) override;
    void resized() override;

private:
    class FieldLookAndFeel final : public juce::LookAndFeel_V4
    {
    public:
        void drawRotarySlider (juce::Graphics&,
                               int x,
                               int y,
                               int width,
                               int height,
                               float sliderPos,
                               float rotaryStartAngle,
                               float rotaryEndAngle,
                               juce::Slider&) override;

        void drawButtonBackground (juce::Graphics&,
                                   juce::Button&,
                                   const juce::Colour& backgroundColour,
                                   bool shouldDrawButtonAsHighlighted,
                                   bool shouldDrawButtonAsDown) override;

        void drawComboBox (juce::Graphics&,
                           int width,
                           int height,
                           bool isButtonDown,
                           int buttonX,
                           int buttonY,
                           int buttonW,
                           int buttonH,
                           juce::ComboBox&) override;
    };

    using SliderAttachment = juce::AudioProcessorValueTreeState::SliderAttachment;
    using ComboAttachment = juce::AudioProcessorValueTreeState::ComboBoxAttachment;

    void timerCallback() override;
    void configureKnob (juce::Slider&, const juce::String& suffix, int decimals);
    void configureCombo (juce::ComboBox&, const juce::StringArray& items);
    void drawObservation (juce::Graphics&, juce::Rectangle<int> area);
    void drawRegister (juce::Graphics&, juce::Rectangle<int> area);
    void drawModuleFrame (juce::Graphics&,
                          juce::Rectangle<int> area,
                          const juce::String& index,
                          const juce::String& title,
                          const juce::String& detail);
    void drawControlLabel (juce::Graphics&,
                           const juce::Component& component,
                           const juce::String& label);

    MZEmergentFieldAudioProcessor& processor;
    FieldLookAndFeel look;

    juce::Slider densitySlider;
    juce::Slider entropySlider;
    juce::Slider energySlider;
    juce::Slider motionSlider;
    juce::Slider spreadSlider;
    juce::Slider selfMixSlider;
    juce::Slider spaceSlider;
    juce::Slider outputSlider;

    juce::ComboBox rootBox;
    juce::ComboBox modeBox;
    juce::ComboBox clockBox;
    juce::TextButton mutateButton { "MUTATE FIELD" };

    std::unique_ptr<SliderAttachment> densityAttachment;
    std::unique_ptr<SliderAttachment> entropyAttachment;
    std::unique_ptr<SliderAttachment> energyAttachment;
    std::unique_ptr<SliderAttachment> motionAttachment;
    std::unique_ptr<SliderAttachment> spreadAttachment;
    std::unique_ptr<SliderAttachment> selfMixAttachment;
    std::unique_ptr<SliderAttachment> spaceAttachment;
    std::unique_ptr<SliderAttachment> outputAttachment;

    std::unique_ptr<ComboAttachment> rootAttachment;
    std::unique_ptr<ComboAttachment> modeAttachment;
    std::unique_ptr<ComboAttachment> clockAttachment;

    juce::Rectangle<int> observationBounds;
    juce::Rectangle<int> registerBounds;
    juce::Rectangle<int> compositionBounds;
    juce::Rectangle<int> motionBounds;
    juce::Rectangle<int> mixBounds;
    juce::Rectangle<int> harmonyBounds;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (MZEmergentFieldAudioProcessorEditor)
};
