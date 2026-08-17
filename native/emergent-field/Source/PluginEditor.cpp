#include "PluginEditor.h"

#include <array>
#include <cmath>

namespace
{
const auto paper = juce::Colour::fromRGB (238, 233, 220);
const auto paperDeep = juce::Colour::fromRGB (213, 208, 196);
const auto paperLight = juce::Colour::fromRGB (250, 246, 235);
const auto ink = juce::Colour::fromRGB (29, 29, 27);
const auto signalColour = juce::Colour::fromRGB (223, 255, 0);
const auto muted = juce::Colour::fromRGB (119, 117, 110);
const auto line = ink.withAlpha (0.28f);

juce::Font displayFont (float size)
{
    return juce::Font (juce::FontOptions (size).withStyle ("Bold"));
}

juce::Font dataFont (float size)
{
    return juce::Font (juce::FontOptions (size).withStyle ("Bold"));
}

juce::String dbText (float gain)
{
    return juce::String (juce::Decibels::gainToDecibels (gain, -72.0f), 1) + " dB";
}
} // namespace

void MZEmergentFieldAudioProcessorEditor::FieldLookAndFeel::drawRotarySlider (
    juce::Graphics& g,
    int x,
    int y,
    int width,
    int height,
    float sliderPos,
    float rotaryStartAngle,
    float rotaryEndAngle,
    juce::Slider&)
{
    auto bounds = juce::Rectangle<float> (static_cast<float> (x),
                                          static_cast<float> (y),
                                          static_cast<float> (width),
                                          static_cast<float> (height)).reduced (8.0f);
    const auto radius = juce::jmin (bounds.getWidth(), bounds.getHeight()) * 0.5f;
    const auto centre = bounds.getCentre();
    const auto angle = juce::jmap (sliderPos, 0.0f, 1.0f, rotaryStartAngle, rotaryEndAngle);

    g.setColour (paperLight);
    g.fillEllipse (centre.x - radius, centre.y - radius, radius * 2.0f, radius * 2.0f);
    g.setColour (ink);
    g.drawEllipse (centre.x - radius, centre.y - radius, radius * 2.0f, radius * 2.0f, 1.5f);

    juce::Path track;
    track.addCentredArc (centre.x, centre.y, radius - 5.0f, radius - 5.0f,
                         0.0f, rotaryStartAngle, rotaryEndAngle, true);
    g.setColour (line);
    g.strokePath (track, juce::PathStrokeType (3.0f));

    juce::Path value;
    value.addCentredArc (centre.x, centre.y, radius - 5.0f, radius - 5.0f,
                         0.0f, rotaryStartAngle, angle, true);
    g.setColour (signalColour);
    g.strokePath (value, juce::PathStrokeType (4.0f));

    const auto pointerRadius = radius - 10.0f;
    const auto endX = centre.x + std::sin (angle) * pointerRadius;
    const auto endY = centre.y - std::cos (angle) * pointerRadius;
    g.setColour (ink);
    g.drawLine (centre.x, centre.y, endX, endY, 2.2f);
    g.fillEllipse (centre.x - 3.0f, centre.y - 3.0f, 6.0f, 6.0f);
}

void MZEmergentFieldAudioProcessorEditor::FieldLookAndFeel::drawButtonBackground (
    juce::Graphics& g,
    juce::Button& button,
    const juce::Colour& backgroundColour,
    bool shouldDrawButtonAsHighlighted,
    bool shouldDrawButtonAsDown)
{
    juce::ignoreUnused (backgroundColour);
    auto area = button.getLocalBounds().toFloat().reduced (0.5f);
    g.setColour (shouldDrawButtonAsDown || shouldDrawButtonAsHighlighted ? signalColour : paperLight);
    g.fillRect (area);
    g.setColour (ink);
    g.drawRect (area, shouldDrawButtonAsDown ? 2.0f : 1.0f);
}

void MZEmergentFieldAudioProcessorEditor::FieldLookAndFeel::drawComboBox (
    juce::Graphics& g,
    int width,
    int height,
    bool isButtonDown,
    int buttonX,
    int buttonY,
    int buttonW,
    int buttonH,
    juce::ComboBox&)
{
    juce::ignoreUnused (isButtonDown, buttonX, buttonY, buttonW, buttonH);
    auto area = juce::Rectangle<float> (0.5f, 0.5f,
                                        static_cast<float> (width - 1),
                                        static_cast<float> (height - 1));
    g.setColour (paperLight);
    g.fillRect (area);
    g.setColour (ink);
    g.drawRect (area, 1.0f);

    const auto arrowX = static_cast<float> (width - 18);
    const auto centreY = static_cast<float> (height) * 0.5f;
    juce::Path arrow;
    arrow.startNewSubPath (arrowX - 4.0f, centreY - 2.0f);
    arrow.lineTo (arrowX, centreY + 2.0f);
    arrow.lineTo (arrowX + 4.0f, centreY - 2.0f);
    g.strokePath (arrow, juce::PathStrokeType (1.5f));
}

MZEmergentFieldAudioProcessorEditor::MZEmergentFieldAudioProcessorEditor (
    MZEmergentFieldAudioProcessor& p)
    : AudioProcessorEditor (&p), processor (p)
{
    setSize (1080, 760);
    setResizable (true, true);
    setResizeLimits (900, 680, 1500, 1040);

    look.setColour (juce::Slider::textBoxTextColourId, ink);
    look.setColour (juce::Slider::textBoxBackgroundColourId, paperLight);
    look.setColour (juce::Slider::textBoxOutlineColourId, ink.withAlpha (0.45f));
    look.setColour (juce::ComboBox::textColourId, ink);
    look.setColour (juce::ComboBox::backgroundColourId, paperLight);
    look.setColour (juce::ComboBox::outlineColourId, ink);
    look.setColour (juce::PopupMenu::backgroundColourId, paperLight);
    look.setColour (juce::PopupMenu::textColourId, ink);
    look.setColour (juce::TextButton::textColourOffId, ink);
    look.setColour (juce::TextButton::textColourOnId, ink);
    setLookAndFeel (&look);

    configureKnob (densitySlider, " %", 0);
    configureKnob (entropySlider, " %", 0);
    configureKnob (energySlider, " %", 0);
    configureKnob (motionSlider, " %", 0);
    configureKnob (spreadSlider, " %", 0);
    configureKnob (selfMixSlider, " %", 0);
    configureKnob (spaceSlider, " %", 0);
    configureKnob (outputSlider, " dB", 1);

    configureCombo (rootBox,
                    { "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B" });
    configureCombo (modeBox, { "DORIAN", "AEOLIAN", "MINOR PENT", "MAJOR PENT", "OPEN" });
    configureCombo (clockBox, { "HOST", "FREE" });

    mutateButton.setColour (juce::TextButton::buttonColourId, paperLight);
    mutateButton.setColour (juce::TextButton::buttonOnColourId, signalColour);
    mutateButton.onClick = [this] { processor.requestMutation(); };

    for (auto* component : std::array<juce::Component*, 12>
         { &densitySlider, &entropySlider, &energySlider, &motionSlider,
           &spreadSlider, &selfMixSlider, &spaceSlider, &outputSlider,
           &rootBox, &modeBox, &clockBox, &mutateButton })
        addAndMakeVisible (*component);

    densityAttachment = std::make_unique<SliderAttachment> (processor.parameters, "density", densitySlider);
    entropyAttachment = std::make_unique<SliderAttachment> (processor.parameters, "entropy", entropySlider);
    energyAttachment = std::make_unique<SliderAttachment> (processor.parameters, "energy", energySlider);
    motionAttachment = std::make_unique<SliderAttachment> (processor.parameters, "motion", motionSlider);
    spreadAttachment = std::make_unique<SliderAttachment> (processor.parameters, "spread", spreadSlider);
    selfMixAttachment = std::make_unique<SliderAttachment> (processor.parameters, "selfMix", selfMixSlider);
    spaceAttachment = std::make_unique<SliderAttachment> (processor.parameters, "space", spaceSlider);
    outputAttachment = std::make_unique<SliderAttachment> (processor.parameters, "output", outputSlider);

    rootAttachment = std::make_unique<ComboAttachment> (processor.parameters, "root", rootBox);
    modeAttachment = std::make_unique<ComboAttachment> (processor.parameters, "mode", modeBox);
    clockAttachment = std::make_unique<ComboAttachment> (processor.parameters, "clock", clockBox);

    startTimerHz (24);
}

MZEmergentFieldAudioProcessorEditor::~MZEmergentFieldAudioProcessorEditor()
{
    setLookAndFeel (nullptr);
}

void MZEmergentFieldAudioProcessorEditor::configureKnob (juce::Slider& slider,
                                                          const juce::String& suffix,
                                                          int decimals)
{
    slider.setSliderStyle (juce::Slider::RotaryHorizontalVerticalDrag);
    slider.setTextBoxStyle (juce::Slider::TextBoxBelow, false, 74, 22);
    slider.setTextValueSuffix (suffix);
    slider.setNumDecimalPlacesToDisplay (decimals);
}

void MZEmergentFieldAudioProcessorEditor::configureCombo (juce::ComboBox& box,
                                                           const juce::StringArray& items)
{
    box.addItemList (items, 1);
    box.setJustificationType (juce::Justification::centred);
}

void MZEmergentFieldAudioProcessorEditor::timerCallback()
{
    repaint();
}

void MZEmergentFieldAudioProcessorEditor::paint (juce::Graphics& g)
{
    g.fillAll (paper);

    auto header = getLocalBounds().removeFromTop (104).reduced (24, 0);
    g.setColour (ink);
    g.fillRect (header.getX(), 8, header.getWidth(), 2);
    g.fillRect (header.getX(), 98, header.getWidth(), 2);

    auto titleArea = header.reduced (0, 12);
    g.setFont (displayFont (48.0f));
    g.drawText ("EMERGENT FIELD", titleArea.removeFromTop (56), juce::Justification::centredLeft);

    g.setFont (dataFont (10.5f));
    g.setColour (muted);
    g.drawText ("MZ SONIC LAB  /  MATCH ZIMMERMAN CREATIVE MEDIA GROUP  /  GENERATIVE MIX-AWARE INSTRUMENT",
                titleArea.removeFromTop (20), juce::Justification::centredLeft);

    auto plate = juce::Rectangle<int> (getWidth() - 172, 24, 144, 52);
    g.setColour (signalColour);
    g.fillRect (plate);
    g.setColour (ink);
    g.drawRect (plate, 1);
    g.setFont (dataFont (10.0f));
    g.drawText ("MZSL / UNIT 07", plate.removeFromTop (24), juce::Justification::centred);
    g.drawText ("FIELD SPECIMEN 0.1", plate, juce::Justification::centred);

    drawObservation (g, observationBounds);
    drawRegister (g, registerBounds);
    drawModuleFrame (g, compositionBounds, "01", "FIELD", "COMPOSITIONAL ATTRACTORS");
    drawModuleFrame (g, motionBounds, "02", "MOTION", "AUTOMATED STEREO FIELD");
    drawModuleFrame (g, mixBounds, "03", "MIX", "INTERNAL NEGOTIATION");
    drawModuleFrame (g, harmonyBounds, "04", "HARMONY / CLOCK", "TONAL FIELD + TRANSPORT");

    drawControlLabel (g, densitySlider, "DENSITY");
    drawControlLabel (g, entropySlider, "ENTROPY");
    drawControlLabel (g, energySlider, "ENERGY");
    drawControlLabel (g, motionSlider, "MOTION");
    drawControlLabel (g, spreadSlider, "SPREAD");
    drawControlLabel (g, selfMixSlider, "SELF MIX");
    drawControlLabel (g, spaceSlider, "SPACE");
    drawControlLabel (g, outputSlider, "OUTPUT");
    drawControlLabel (g, rootBox, "ROOT");
    drawControlLabel (g, modeBox, "MODE");
    drawControlLabel (g, clockBox, "CLOCK");
    drawControlLabel (g, mutateButton, "FIELD EVENT");

    g.setColour (muted);
    g.setFont (dataFont (9.0f));
    g.drawText ("MZCMG + MATCH ZIMMERMAN CREATIVE MEDIA GROUP  //  AU · VST3 · STANDALONE  //  INTERNAL SIDECHAIN ECOLOGY",
                24, getHeight() - 28, getWidth() - 48, 18, juce::Justification::centredLeft);
}

void MZEmergentFieldAudioProcessorEditor::drawObservation (juce::Graphics& g,
                                                            juce::Rectangle<int> area)
{
    if (area.isEmpty())
        return;

    const auto telemetry = processor.getTelemetry();
    g.setColour (ink);
    g.drawRect (area, 2);

    auto header = area.removeFromTop (34).reduced (12, 0);
    g.setFont (dataFont (10.0f));
    g.drawText ("PRIMARY OBSERVATION / INTERNAL STREAM FIELD", header, juce::Justification::centredLeft);
    g.drawText (telemetry.running ? "SYSTEM ONLINE" : "WAITING FOR TRANSPORT",
                header, juce::Justification::centredRight);

    auto body = area.reduced (10, 8);
    const auto laneWidth = body.getWidth() / mz::GenerativeEngine::numStreams;

    for (int i = 0; i < mz::GenerativeEngine::numStreams; ++i)
    {
        auto lane = body.withX (body.getX() + laneWidth * i).withWidth (laneWidth);
        if (i > 0)
        {
            g.setColour (line);
            g.drawVerticalLine (lane.getX(), static_cast<float> (lane.getY()),
                                static_cast<float> (lane.getBottom()));
        }

        auto label = lane.removeFromBottom (28);
        auto panArea = lane.removeFromBottom (28).reduced (10, 5);
        auto duckArea = lane.removeFromBottom (20);
        auto meter = lane.reduced (18, 5);

        const auto level = telemetry.levels[static_cast<std::size_t> (i)];
        const auto db = juce::Decibels::gainToDecibels (level, -72.0f);
        const auto levelNorm = juce::jlimit (0.0f, 1.0f, (db + 60.0f) / 60.0f);

        g.setColour (paperLight);
        g.fillRect (meter);
        g.setColour (line);
        g.drawRect (meter, 1);

        auto fill = meter.reduced (4);
        fill.removeFromTop (juce::roundToInt (fill.getHeight() * (1.0f - levelNorm)));
        g.setColour (signalColour);
        g.fillRect (fill);

        g.setColour (ink);
        g.setFont (dataFont (9.5f));
        g.drawText (dbText (level), duckArea, juce::Justification::centred);

        g.setColour (line);
        g.drawHorizontalLine (panArea.getCentreY(),
                              static_cast<float> (panArea.getX()),
                              static_cast<float> (panArea.getRight()));
        g.setColour (ink);
        g.drawVerticalLine (panArea.getCentreX(),
                            static_cast<float> (panArea.getY()),
                            static_cast<float> (panArea.getBottom()));

        const auto pan = juce::jlimit (-1.0f, 1.0f, telemetry.pans[static_cast<std::size_t> (i)]);
        const auto panX = juce::jmap (pan, -1.0f, 1.0f,
                                     static_cast<float> (panArea.getX()),
                                     static_cast<float> (panArea.getRight()));
        g.setColour (signalColour);
        g.fillEllipse (panX - 4.0f, static_cast<float> (panArea.getCentreY()) - 4.0f, 8.0f, 8.0f);
        g.setColour (ink);
        g.drawEllipse (panX - 4.0f, static_cast<float> (panArea.getCentreY()) - 4.0f, 8.0f, 8.0f, 1.0f);

        g.setFont (dataFont (9.5f));
        g.drawText (mz::GenerativeEngine::streamName (i), label, juce::Justification::centred);

        const auto duck = telemetry.duckDb[static_cast<std::size_t> (i)];
        g.setColour (muted);
        g.setFont (dataFont (8.0f));
        g.drawText ("YIELD " + juce::String (duck, 1) + " dB",
                    label.translated (0, -17), juce::Justification::centred);
    }
}

void MZEmergentFieldAudioProcessorEditor::drawRegister (juce::Graphics& g,
                                                         juce::Rectangle<int> area)
{
    if (area.isEmpty())
        return;

    const auto telemetry = processor.getTelemetry();
    g.setColour (ink);
    g.drawRect (area, 1);

    const auto cellWidth = area.getWidth() / 4;
    const std::array<juce::String, 4> labels {
        "CLOCK / STATE", "FIELD PRESSURE", "ADAPT DENSITY", "OUTPUT"
    };

    const auto pressurePercent = juce::jlimit (0.0f, 100.0f, telemetry.pressure / 0.72f * 100.0f);
    const auto densityPercent = juce::jlimit (0.0f, 100.0f, telemetry.adaptiveDensity * 100.0f);
    const std::array<juce::String, 4> values {
        juce::String (telemetry.bpm, 1) + " BPM / " + (telemetry.running ? "RUN" : "STOP"),
        juce::String (pressurePercent, 0) + " %",
        juce::String (densityPercent, 0) + " %",
        dbText (telemetry.outputRms)
    };

    for (int i = 0; i < 4; ++i)
    {
        auto cell = area.withX (area.getX() + cellWidth * i).withWidth (cellWidth).reduced (12, 7);
        if (i > 0)
        {
            g.setColour (line);
            g.drawVerticalLine (area.getX() + cellWidth * i,
                                static_cast<float> (area.getY()),
                                static_cast<float> (area.getBottom()));
        }

        g.setColour (muted);
        g.setFont (dataFont (8.5f));
        g.drawText (labels[static_cast<std::size_t> (i)], cell.removeFromTop (16),
                    juce::Justification::centredLeft);
        g.setColour (ink);
        g.setFont (dataFont (13.0f));
        g.drawText (values[static_cast<std::size_t> (i)], cell,
                    juce::Justification::centredLeft);
    }
}

void MZEmergentFieldAudioProcessorEditor::drawModuleFrame (
    juce::Graphics& g,
    juce::Rectangle<int> area,
    const juce::String& index,
    const juce::String& title,
    const juce::String& detail)
{
    if (area.isEmpty())
        return;

    g.setColour (ink);
    g.fillRect (area.getX(), area.getY(), area.getWidth(), 2);
    g.setColour (line);
    g.drawRect (area, 1);

    auto heading = area.removeFromTop (42).reduced (10, 8);
    auto indexBox = heading.removeFromLeft (26).withSizeKeepingCentre (24, 24);
    g.setColour (signalColour);
    g.fillRect (indexBox);
    g.setColour (ink);
    g.drawRect (indexBox, 1);
    g.setFont (dataFont (8.0f));
    g.drawText (index, indexBox, juce::Justification::centred);

    heading.removeFromLeft (8);
    auto titleArea = heading.removeFromLeft (juce::jmin (140, heading.getWidth()));
    g.setFont (displayFont (15.0f));
    g.drawText (title, titleArea, juce::Justification::centredLeft);

    g.setColour (muted);
    g.setFont (dataFont (8.0f));
    g.drawText (detail, heading, juce::Justification::centredRight);
}

void MZEmergentFieldAudioProcessorEditor::drawControlLabel (
    juce::Graphics& g,
    const juce::Component& component,
    const juce::String& label)
{
    if (! component.isVisible())
        return;

    g.setColour (muted);
    g.setFont (dataFont (9.0f));
    g.drawText (label, component.getBounds().translated (0, -16).withHeight (16),
                juce::Justification::centred);
}

void MZEmergentFieldAudioProcessorEditor::resized()
{
    auto content = getLocalBounds().reduced (24, 0);
    content.removeFromTop (112);

    observationBounds = content.removeFromTop (238);
    content.removeFromTop (8);
    registerBounds = content.removeFromTop (58);
    content.removeFromTop (12);

    auto modules = content.removeFromTop (214);
    const auto gap = 8;
    const auto compositionWidth = juce::roundToInt (modules.getWidth() * 0.36f);
    const auto motionWidth = juce::roundToInt (modules.getWidth() * 0.25f);

    compositionBounds = modules.removeFromLeft (compositionWidth);
    modules.removeFromLeft (gap);
    motionBounds = modules.removeFromLeft (motionWidth);
    modules.removeFromLeft (gap);
    mixBounds = modules;

    auto placeKnobs = [] (juce::Rectangle<int> area,
                          std::initializer_list<juce::Slider*> sliders)
    {
        area.removeFromTop (52);
        area = area.reduced (10, 4);
        const auto count = static_cast<int> (sliders.size());
        const auto cellWidth = count > 0 ? area.getWidth() / count : area.getWidth();
        auto x = area.getX();
        for (auto* slider : sliders)
        {
            auto cell = juce::Rectangle<int> (x, area.getY(), cellWidth, area.getHeight());
            slider->setBounds (cell.reduced (5, 3));
            x += cellWidth;
        }
    };

    placeKnobs (compositionBounds, { &densitySlider, &entropySlider, &energySlider });
    placeKnobs (motionBounds, { &motionSlider, &spreadSlider });
    placeKnobs (mixBounds, { &selfMixSlider, &spaceSlider, &outputSlider });

    content.removeFromTop (10);
    harmonyBounds = content.removeFromTop (82);
    auto harmony = harmonyBounds;
    harmony.removeFromTop (42);
    harmony = harmony.reduced (10, 4);

    const auto comboWidth = juce::jmax (120, juce::roundToInt (harmony.getWidth() * 0.16f));
    rootBox.setBounds (harmony.removeFromLeft (comboWidth).reduced (4, 0));
    modeBox.setBounds (harmony.removeFromLeft (comboWidth + 28).reduced (4, 0));
    clockBox.setBounds (harmony.removeFromLeft (comboWidth).reduced (4, 0));
    mutateButton.setBounds (harmony.removeFromRight (juce::jmin (190, harmony.getWidth())).reduced (4, 0));
}
