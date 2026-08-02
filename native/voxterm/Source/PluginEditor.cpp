#include "PluginEditor.h"

namespace
{
const auto background = juce::Colour::fromRGB (5, 9, 7);
const auto panel = juce::Colour::fromRGB (13, 20, 16);
const auto terminalGreen = juce::Colour::fromRGB (211, 255, 69);
const auto dimGreen = juce::Colour::fromRGB (93, 122, 55);
const auto alertOrange = juce::Colour::fromRGB (255, 142, 48);
}

VoxTermAudioProcessorEditor::VoxTermAudioProcessorEditor (VoxTermAudioProcessor& p)
    : AudioProcessorEditor (&p),
      processor (p),
      keyboard (processor.keyboardState, juce::MidiKeyboardComponent::horizontalKeyboard)
{
    setSize (1180, 760);
    setResizable (true, true);
    setResizeLimits (920, 640, 1600, 1050);

    terminalLook.setColour (juce::Slider::rotarySliderFillColourId, terminalGreen);
    terminalLook.setColour (juce::Slider::rotarySliderOutlineColourId, dimGreen.withAlpha (0.65f));
    terminalLook.setColour (juce::Slider::thumbColourId, terminalGreen);
    terminalLook.setColour (juce::Slider::textBoxTextColourId, terminalGreen);
    terminalLook.setColour (juce::Slider::textBoxBackgroundColourId, background);
    terminalLook.setColour (juce::Slider::textBoxOutlineColourId, dimGreen);
    terminalLook.setColour (juce::ComboBox::backgroundColourId, background);
    terminalLook.setColour (juce::ComboBox::textColourId, terminalGreen);
    terminalLook.setColour (juce::ComboBox::outlineColourId, dimGreen);
    terminalLook.setColour (juce::PopupMenu::backgroundColourId, panel);
    terminalLook.setColour (juce::PopupMenu::textColourId, terminalGreen);
    terminalLook.setColour (juce::TextButton::buttonColourId, panel);
    terminalLook.setColour (juce::TextButton::buttonOnColourId, alertOrange);
    terminalLook.setColour (juce::TextButton::textColourOffId, terminalGreen);
    terminalLook.setColour (juce::TextButton::textColourOnId, background);
    setLookAndFeel (&terminalLook);

    messageEditor.setMultiLine (true);
    messageEditor.setReturnKeyStartsNewLine (true);
    messageEditor.setScrollbarsShown (true);
    messageEditor.setColour (juce::TextEditor::backgroundColourId, background);
    messageEditor.setColour (juce::TextEditor::textColourId, terminalGreen);
    messageEditor.setColour (juce::TextEditor::outlineColourId, dimGreen);
    messageEditor.setColour (juce::TextEditor::focusedOutlineColourId, terminalGreen);
    messageEditor.setColour (juce::CaretComponent::caretColourId, terminalGreen);
    messageEditor.setFont (juce::Font (juce::FontOptions (18.0f).withTypefaceStyle ("Regular")));
    messageEditor.setText (processor.getMessageText(), false);
    messageEditor.setInputRestrictions (512);
    messageEditor.onTextChange = [this]
    {
        processor.setMessageText (messageEditor.getText());
    };
    addAndMakeVisible (messageEditor);

    transmitButton.onClick = [this]
    {
        processor.setMessageText (messageEditor.getText());
        processor.requestSpeechGeneration (true);
    };
    playButton.onClick = [this] { processor.requestPlayback(); };
    addAndMakeVisible (transmitButton);
    addAndMakeVisible (playButton);

    statusLabel.setJustificationType (juce::Justification::centredLeft);
    statusLabel.setColour (juce::Label::textColourId, terminalGreen);
    statusLabel.setFont (juce::Font (juce::FontOptions (14.0f).withTypefaceStyle ("Bold")));
    addAndMakeVisible (statusLabel);

    configureCombo (voiceBox, "VOICE PROFILE",
                    { "MAINFRAME", "ORBITAL", "SERVICE", "ARCHIVE" });
    configureCombo (modeBox, "PLAY MODE",
                    { "ONE SHOT", "GATE", "LOOP" });

    configureSlider (speechRate, "SPEECH RATE", 3);
    configureSlider (speechPitch, "SPEECH PITCH", 3);
    configureSlider (playbackRate, "TAPE RATE", 3);
    configureSlider (bitDepth, "BIT DEPTH", 0);
    configureSlider (reduction, "SAMPLE HOLD", 0);
    configureSlider (ringFrequency, "CARRIER HZ", 1);
    configureSlider (ringMix, "CARRIER MIX", 3);
    configureSlider (noise, "LINE NOISE", 3);
    configureSlider (cutoff, "TERMINAL FILTER", 0);
    configureSlider (drive, "MACHINE DRIVE", 3);
    configureSlider (drift, "VOLTAGE DRIFT", 3);
    configureSlider (masterGain, "OUTPUT DB", 1);

    voiceAttachment = std::make_unique<ComboAttachment> (processor.parameters, "voice", voiceBox);
    modeAttachment = std::make_unique<ComboAttachment> (processor.parameters, "playMode", modeBox);
    speechRateAttachment = std::make_unique<SliderAttachment> (processor.parameters, "speechRate", speechRate);
    speechPitchAttachment = std::make_unique<SliderAttachment> (processor.parameters, "speechPitch", speechPitch);
    playbackRateAttachment = std::make_unique<SliderAttachment> (processor.parameters, "playbackRate", playbackRate);
    bitDepthAttachment = std::make_unique<SliderAttachment> (processor.parameters, "bitDepth", bitDepth);
    reductionAttachment = std::make_unique<SliderAttachment> (processor.parameters, "reduction", reduction);
    ringFrequencyAttachment = std::make_unique<SliderAttachment> (processor.parameters, "ringFrequency", ringFrequency);
    ringMixAttachment = std::make_unique<SliderAttachment> (processor.parameters, "ringMix", ringMix);
    noiseAttachment = std::make_unique<SliderAttachment> (processor.parameters, "noise", noise);
    cutoffAttachment = std::make_unique<SliderAttachment> (processor.parameters, "cutoff", cutoff);
    driveAttachment = std::make_unique<SliderAttachment> (processor.parameters, "drive", drive);
    driftAttachment = std::make_unique<SliderAttachment> (processor.parameters, "drift", drift);
    masterGainAttachment = std::make_unique<SliderAttachment> (processor.parameters, "masterGain", masterGain);

    controlSlots = { &voiceBox, &speechRate, &speechPitch, &playbackRate,
                     &modeBox, &bitDepth, &reduction,
                     &ringFrequency, &ringMix, &noise, &cutoff,
                     &drive, &drift, &masterGain };

    keyboard.setColour (juce::MidiKeyboardComponent::whiteNoteColourId, panel.brighter (0.15f));
    keyboard.setColour (juce::MidiKeyboardComponent::blackNoteColourId, background);
    keyboard.setColour (juce::MidiKeyboardComponent::keySeparatorLineColourId, dimGreen);
    keyboard.setColour (juce::MidiKeyboardComponent::mouseOverKeyOverlayColourId,
                        terminalGreen.withAlpha (0.2f));
    keyboard.setColour (juce::MidiKeyboardComponent::keyDownOverlayColourId,
                        alertOrange.withAlpha (0.75f));
    keyboard.setAvailableRange (36, 96);
    addAndMakeVisible (keyboard);

    startTimerHz (24);
}

VoxTermAudioProcessorEditor::~VoxTermAudioProcessorEditor()
{
    setLookAndFeel (nullptr);
}

void VoxTermAudioProcessorEditor::configureSlider (juce::Slider& slider,
                                                    const juce::String& name,
                                                    int decimals)
{
    slider.setName (name);
    slider.setSliderStyle (juce::Slider::RotaryHorizontalVerticalDrag);
    slider.setTextBoxStyle (juce::Slider::TextBoxBelow, false, 78, 20);
    slider.setNumDecimalPlacesToDisplay (decimals);
    slider.setDoubleClickReturnValue (true, 0.0);
    addAndMakeVisible (slider);
}

void VoxTermAudioProcessorEditor::configureCombo (juce::ComboBox& combo,
                                                   const juce::String& name,
                                                   const juce::StringArray& items)
{
    combo.setName (name);
    auto itemId = 1;
    for (const auto& item : items)
        combo.addItem (item, itemId++);
    addAndMakeVisible (combo);
}

void VoxTermAudioProcessorEditor::paint (juce::Graphics& g)
{
    g.fillAll (background);

    for (auto y = 0; y < getHeight(); y += 6)
    {
        g.setColour (terminalGreen.withAlpha (0.025f));
        g.drawHorizontalLine (y, 0.0f, static_cast<float> (getWidth()));
    }

    g.setColour (terminalGreen);
    g.setFont (juce::Font (juce::FontOptions (32.0f).withTypefaceStyle ("Bold")));
    g.drawText ("MZ-05  VOX//TERM", 28, 18, getWidth() - 56, 38,
                juce::Justification::centredLeft, false);

    g.setColour (dimGreen);
    g.setFont (juce::Font (juce::FontOptions (12.0f).withTypefaceStyle ("Bold")));
    g.drawText ("TEXT-TO-MACHINE SPEECH INSTRUMENT  //  FIELD BUILD 0.1",
                30, 56, getWidth() - 60, 20,
                juce::Justification::centredLeft, false);

    auto messagePanel = messageEditor.getBounds().expanded (12, 30);
    messagePanel.setTop (messageEditor.getY() - 34);
    g.setColour (panel);
    g.fillRect (messagePanel);
    g.setColour (dimGreen);
    g.drawRect (messagePanel, 1);
    g.setColour (terminalGreen);
    g.setFont (juce::Font (juce::FontOptions (11.0f).withTypefaceStyle ("Bold")));
    g.drawText ("INPUT BUFFER // TYPE PHRASE BELOW",
                messagePanel.getX() + 12, messagePanel.getY() + 7,
                messagePanel.getWidth() - 24, 16,
                juce::Justification::centredLeft, false);

    if (! controlSlots.empty())
    {
        auto controlPanel = controlSlots.front()->getBounds();
        for (const auto* control : controlSlots)
            controlPanel = controlPanel.getUnion (control->getBounds());
        controlPanel = controlPanel.expanded (12, 28);

        g.setColour (panel.withAlpha (0.78f));
        g.fillRect (controlPanel);
        g.setColour (dimGreen);
        g.drawRect (controlPanel, 1);

        for (const auto* control : controlSlots)
            drawControlLabel (g, *control);
    }

    const auto meterWidth = juce::jmin (260, getWidth() / 4);
    const juce::Rectangle<int> meter (getWidth() - meterWidth - 28, 30, meterWidth, 14);
    g.setColour (panel);
    g.fillRect (meter);
    g.setColour (dimGreen);
    g.drawRect (meter, 1);
    g.setColour (terminalGreen);
    g.fillRect (meter.reduced (2).withWidth (juce::roundToInt (
        static_cast<float> (meter.getWidth() - 4)
        * juce::jlimit (0.0f, 1.0f, processor.getOutputLevel() * 2.4f))));
}

void VoxTermAudioProcessorEditor::drawControlLabel (juce::Graphics& g,
                                                     const juce::Component& component) const
{
    g.setColour (terminalGreen.withAlpha (0.86f));
    g.setFont (juce::Font (juce::FontOptions (10.0f).withTypefaceStyle ("Bold")));
    const auto bounds = component.getBounds();
    g.drawText (component.getName(), bounds.getX(), bounds.getY() - 18,
                bounds.getWidth(), 14, juce::Justification::centred, false);
}

void VoxTermAudioProcessorEditor::resized()
{
    auto area = getLocalBounds().reduced (28);
    area.removeFromTop (72);

    auto messageArea = area.removeFromTop (190);
    auto buttonArea = messageArea.removeFromRight (300);
    messageEditor.setBounds (messageArea.reduced (12, 28).withTrimmedTop (4));

    buttonArea = buttonArea.reduced (18, 26);
    transmitButton.setBounds (buttonArea.removeFromTop (46));
    buttonArea.removeFromTop (12);
    playButton.setBounds (buttonArea.removeFromTop (38));
    buttonArea.removeFromTop (10);
    statusLabel.setBounds (buttonArea.removeFromTop (50));

    area.removeFromTop (28);
    auto controlsArea = area.removeFromTop (320).reduced (8, 24);
    const auto columns = 7;
    const auto rows = 2;
    const auto cellWidth = controlsArea.getWidth() / columns;
    const auto cellHeight = controlsArea.getHeight() / rows;

    for (size_t index = 0; index < controlSlots.size(); ++index)
    {
        const auto column = static_cast<int> (index) % columns;
        const auto row = static_cast<int> (index) / columns;
        juce::Rectangle<int> cell (controlsArea.getX() + column * cellWidth,
                                   controlsArea.getY() + row * cellHeight,
                                   cellWidth, cellHeight);
        cell = cell.reduced (7, 10).withTrimmedTop (10);

        if (dynamic_cast<juce::ComboBox*> (controlSlots[index]) != nullptr)
            controlSlots[index]->setBounds (cell.withSizeKeepingCentre (cell.getWidth() - 12, 34));
        else
            controlSlots[index]->setBounds (cell);
    }

    area.removeFromTop (18);
    keyboard.setBounds (area.removeFromBottom (92));
}

void VoxTermAudioProcessorEditor::timerCallback()
{
    statusLabel.setText (processor.getRenderStatusText(), juce::dontSendNotification);
    statusLabel.setColour (juce::Label::textColourId,
        processor.getRenderStatusText().containsIgnoreCase ("ERROR")
            ? alertOrange
            : terminalGreen);
    repaint();
}

juce::AudioProcessorEditor* VoxTermAudioProcessor::createEditor()
{
    return new VoxTermAudioProcessorEditor (*this);
}
