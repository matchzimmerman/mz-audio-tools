#pragma once

#include <JuceHeader.h>
#include <array>
#include <memory>
#include <vector>

#include "PluginProcessor.h"

class SonarAudioProcessorEditor final : public juce::AudioProcessorEditor,
                                        private juce::Timer
{
public:
    explicit SonarAudioProcessorEditor (SonarAudioProcessor&);
    ~SonarAudioProcessorEditor() override;

    void paint (juce::Graphics&) override;
    void resized() override;

private:
    class SonarLookAndFeel;
    class KnobControl;
    class ChoiceControl;
    class ToggleControl;
    class RadarComponent;

    void timerCallback() override;
    void clearSequence();
    void loadPattern (int pattern);
    void setStepRing (int step, int ring);

    SonarAudioProcessor& processor;
    std::unique_ptr<SonarLookAndFeel> lookAndFeel;
    std::unique_ptr<RadarComponent> radar;

    std::unique_ptr<ChoiceControl> mode;
    std::unique_ptr<ChoiceControl> cycle;
    std::unique_ptr<ChoiceControl> monitor;
    std::unique_ptr<ToggleControl> clockwise;
    std::unique_ptr<KnobControl> angle;
    std::unique_ptr<KnobControl> distance;
    std::unique_ptr<KnobControl> smoothing;
    std::unique_ptr<KnobControl> rear;
    std::unique_ptr<KnobControl> space;
    std::unique_ptr<KnobControl> mix;
    std::unique_ptr<KnobControl> input;
    std::unique_ptr<KnobControl> output;

    juce::TextButton clearButton { "CLEAR FIELD" };
    juce::TextButton quartersButton { "QUARTERS" };
    juce::TextButton backbeatButton { "BACKBEAT" };
    juce::TextButton perimeterButton { "PERIMETER" };

    juce::Rectangle<int> radarPanel;
    juce::Rectangle<int> controlPanel;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (SonarAudioProcessorEditor)
};
