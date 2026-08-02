#pragma once

#include <JuceHeader.h>
#include <array>
#include <memory>
#include <vector>

#include "PluginProcessor.h"

class CoastsAudioProcessorEditor final : public juce::AudioProcessorEditor,
                                         private juce::Timer
{
public:
    explicit CoastsAudioProcessorEditor (CoastsAudioProcessor&);
    ~CoastsAudioProcessorEditor() override;

    void paint (juce::Graphics&) override;
    void resized() override;

private:
    class FieldLookAndFeel;
    class KnobControl;
    class ChoiceControl;
    class ToggleControl;
    class OutputTrace;

    void timerCallback() override;
    void setMode (int modeIndex);
    void updateModeVisibility();
    void layoutEastControls (juce::Rectangle<int> modules);
    void layoutWestControls (juce::Rectangle<int> modules);
    void drawModule (juce::Graphics&, juce::Rectangle<int>,
                     const juce::String& index,
                     const juce::String& title,
                     const juce::String& subtitle,
                     const juce::String& code) const;

    CoastsAudioProcessor& processor;
    std::unique_ptr<FieldLookAndFeel> fieldLookAndFeel;
    std::unique_ptr<OutputTrace> outputTrace;

    juce::TextButton eastButton { "EAST COAST / SUBTRACT" };
    juce::TextButton westButton { "WEST COAST / MUTATE" };

    std::unique_ptr<ChoiceControl> eastOsc1;
    std::unique_ptr<ChoiceControl> eastOsc2;
    std::unique_ptr<KnobControl> eastDetune;
    std::unique_ptr<KnobControl> eastBalance;
    std::unique_ptr<KnobControl> eastCutoff;
    std::unique_ptr<KnobControl> eastResonance;
    std::unique_ptr<KnobControl> eastFilterEnv;
    std::unique_ptr<KnobControl> eastAttack;
    std::unique_ptr<KnobControl> eastDecay;
    std::unique_ptr<KnobControl> eastSustain;
    std::unique_ptr<KnobControl> eastRelease;

    std::unique_ptr<ChoiceControl> westRatio;
    std::unique_ptr<KnobControl> westFm;
    std::unique_ptr<KnobControl> westFold;
    std::unique_ptr<KnobControl> westSymmetry;
    std::unique_ptr<KnobControl> westUncertainty;
    std::unique_ptr<KnobControl> westRise;
    std::unique_ptr<KnobControl> westFall;
    std::unique_ptr<ToggleControl> westLoop;
    std::unique_ptr<KnobControl> westColor;
    std::unique_ptr<KnobControl> westRing;

    std::unique_ptr<KnobControl> masterGain;

    std::vector<juce::Component*> eastComponents;
    std::vector<juce::Component*> westComponents;

    std::array<juce::Rectangle<int>, 3> moduleBounds;
    int visibleMode = -1;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (CoastsAudioProcessorEditor)
};
