#include "PluginEditor.h"

#include <cmath>

namespace
{
const auto voidColour = juce::Colour (0xff111510);
const auto panel = juce::Colour (0xff182018);
const auto panelRaised = juce::Colour (0xff202a20);
const auto phosphor = juce::Colour (0xffdfff00);
const auto phosphorDim = juce::Colour (0xff829300);
const auto paper = juce::Colour (0xffeee9dc);
const auto grid = juce::Colour (0x558ca46d);
const auto muted = juce::Colour (0xff8f9987);
constexpr auto twoPi = juce::MathConstants<float>::twoPi;

juce::Font displayFont (float size)
{
    return juce::Font (juce::Font::getDefaultSansSerifFontName(), size, juce::Font::bold);
}

juce::Font dataFont (float size)
{
    return juce::Font (juce::Font::getDefaultMonospacedFontName(), size, juce::Font::bold);
}

juce::String stepId (int step)
{
    return "step" + juce::String (step + 1).paddedLeft ('0', 2);
}
}

class SonarAudioProcessorEditor::SonarLookAndFeel final : public juce::LookAndFeel_V4
{
public:
    SonarLookAndFeel()
    {
        setColour (juce::Slider::textBoxTextColourId, paper);
        setColour (juce::Slider::textBoxBackgroundColourId, voidColour);
        setColour (juce::Slider::textBoxOutlineColourId, grid);
        setColour (juce::TextButton::buttonColourId, panel);
        setColour (juce::TextButton::buttonOnColourId, phosphor);
        setColour (juce::TextButton::textColourOffId, paper);
        setColour (juce::TextButton::textColourOnId, voidColour);
        setColour (juce::ComboBox::backgroundColourId, voidColour);
        setColour (juce::ComboBox::outlineColourId, grid);
        setColour (juce::ComboBox::textColourId, paper);
        setColour (juce::ComboBox::arrowColourId, phosphor);
        setColour (juce::PopupMenu::backgroundColourId, voidColour);
        setColour (juce::PopupMenu::textColourId, paper);
        setColour (juce::PopupMenu::highlightedBackgroundColourId, phosphor);
        setColour (juce::PopupMenu::highlightedTextColourId, voidColour);
        setColour (juce::Label::textColourId, paper);
        setColour (juce::ToggleButton::textColourId, paper);
    }

    void drawRotarySlider (juce::Graphics& g,
                           int x,
                           int y,
                           int width,
                           int height,
                           float position,
                           float startAngle,
                           float endAngle,
                           juce::Slider&) override
    {
        const auto bounds = juce::Rectangle<float> (static_cast<float> (x),
                                                     static_cast<float> (y),
                                                     static_cast<float> (width),
                                                     static_cast<float> (height)).reduced (9.0f);
        const auto radius = juce::jmin (bounds.getWidth(), bounds.getHeight()) * 0.5f;
        const auto centre = bounds.getCentre();
        const auto angleValue = startAngle + position * (endAngle - startAngle);

        g.setColour (panelRaised);
        g.fillEllipse (bounds);
        g.setColour (grid);
        g.drawEllipse (bounds, 1.0f);

        juce::Path arc;
        arc.addCentredArc (centre.x, centre.y,
                           radius - 4.0f, radius - 4.0f,
                           0.0f, startAngle, angleValue, true);
        g.setColour (phosphor);
        g.strokePath (arc, juce::PathStrokeType (3.0f));

        const auto direction = juce::Point<float> (std::sin (angleValue), -std::cos (angleValue));
        g.drawLine ({ centre, centre + direction * (radius * 0.72f) }, 2.0f);
        g.fillEllipse (juce::Rectangle<float> (4.0f, 4.0f).withCentre (centre));
    }

    void drawButtonBackground (juce::Graphics& g,
                               juce::Button& button,
                               const juce::Colour&,
                               bool highlighted,
                               bool down) override
    {
        const auto active = button.getToggleState() || highlighted || down;
        g.setColour (active ? phosphor : panel);
        g.fillRect (button.getLocalBounds());
        g.setColour (active ? voidColour : grid);
        g.drawRect (button.getLocalBounds(), 1);
    }

    void drawButtonText (juce::Graphics& g,
                         juce::TextButton& button,
                         bool highlighted,
                         bool down) override
    {
        const auto active = button.getToggleState() || highlighted || down;
        g.setColour (active ? voidColour : paper);
        g.setFont (dataFont (9.0f));
        g.drawFittedText (button.getButtonText(), button.getLocalBounds().reduced (6),
                          juce::Justification::centred, 2);
    }

    void drawToggleButton (juce::Graphics& g,
                           juce::ToggleButton& button,
                           bool highlighted,
                           bool down) override
    {
        auto bounds = button.getLocalBounds();
        const auto switchBounds = bounds.removeFromLeft (48).reduced (2, 8);
        const auto active = button.getToggleState();
        g.setColour (active || highlighted || down ? phosphor : panelRaised);
        g.fillRect (switchBounds);
        g.setColour (grid);
        g.drawRect (switchBounds, 1);
        g.setColour (active ? voidColour : paper);
        g.fillEllipse (juce::Rectangle<float> (12.0f, 12.0f)
            .withCentre ({ active ? static_cast<float> (switchBounds.getRight() - 10)
                                   : static_cast<float> (switchBounds.getX() + 10),
                           static_cast<float> (switchBounds.getCentreY()) }));
        g.setColour (paper);
        g.setFont (dataFont (9.0f));
        g.drawFittedText (button.getButtonText(), bounds.reduced (7, 0),
                          juce::Justification::centredLeft, 2);
    }
};

class SonarAudioProcessorEditor::KnobControl final : public juce::Component
{
public:
    KnobControl (juce::AudioProcessorValueTreeState& state,
                 const juce::String& id,
                 const juce::String& name,
                 const juce::String& suffix = {})
        : attachment (state, id, slider)
    {
        label.setText (name, juce::dontSendNotification);
        label.setFont (dataFont (8.0f));
        label.setJustificationType (juce::Justification::centred);
        addAndMakeVisible (label);

        slider.setSliderStyle (juce::Slider::RotaryHorizontalVerticalDrag);
        slider.setTextBoxStyle (juce::Slider::TextBoxBelow, false, 64, 18);
        slider.setTextValueSuffix (suffix);
        slider.setMouseDragSensitivity (180);
        addAndMakeVisible (slider);
    }

    void resized() override
    {
        auto area = getLocalBounds();
        label.setBounds (area.removeFromTop (18));
        slider.setBounds (area);
    }

private:
    juce::Label label;
    juce::Slider slider;
    juce::AudioProcessorValueTreeState::SliderAttachment attachment;
};

class SonarAudioProcessorEditor::ChoiceControl final : public juce::Component
{
public:
    ChoiceControl (juce::AudioProcessorValueTreeState& state,
                   const juce::String& id,
                   const juce::String& name,
                   const juce::StringArray& choices)
        : attachment (state, id, combo)
    {
        label.setText (name, juce::dontSendNotification);
        label.setFont (dataFont (8.0f));
        addAndMakeVisible (label);
        combo.addItemList (choices, 1);
        addAndMakeVisible (combo);
    }

    void resized() override
    {
        auto area = getLocalBounds();
        label.setBounds (area.removeFromTop (16));
        combo.setBounds (area.removeFromTop (34));
    }

private:
    juce::Label label;
    juce::ComboBox combo;
    juce::AudioProcessorValueTreeState::ComboBoxAttachment attachment;
};

class SonarAudioProcessorEditor::ToggleControl final : public juce::Component
{
public:
    ToggleControl (juce::AudioProcessorValueTreeState& state,
                   const juce::String& id,
                   const juce::String& name)
        : attachment (state, id, button)
    {
        button.setButtonText (name);
        addAndMakeVisible (button);
    }

    void resized() override { button.setBounds (getLocalBounds()); }

private:
    juce::ToggleButton button;
    juce::AudioProcessorValueTreeState::ButtonAttachment attachment;
};

class SonarAudioProcessorEditor::RadarComponent final : public juce::Component,
                                                         private juce::Timer
{
public:
    RadarComponent (SonarAudioProcessor& owner,
                    std::function<void (int, int)> stepSetter)
        : processor (owner), setStep (std::move (stepSetter))
    {
        setMouseCursor (juce::MouseCursor::CrosshairCursor);
        startTimerHz (30);
    }

    void paint (juce::Graphics& g) override
    {
        const auto bounds = getLocalBounds().toFloat();
        g.setColour (voidColour);
        g.fillRoundedRectangle (bounds, 4.0f);
        g.setColour (grid);
        g.drawRoundedRectangle (bounds.reduced (0.5f), 4.0f, 1.0f);

        const auto fieldSize = juce::jmin (bounds.getWidth() - 44.0f, bounds.getHeight() - 44.0f);
        const auto square = bounds.reduced (22.0f).withSizeKeepingCentre (fieldSize, fieldSize);
        const auto centre = square.getCentre();
        const auto radius = square.getWidth() * 0.5f;

        for (auto ring = 1; ring <= 4; ++ring)
        {
            const auto diameter = radius * 2.0f * static_cast<float> (ring) / 4.0f;
            const auto circle = juce::Rectangle<float> (diameter, diameter).withCentre (centre);
            g.setColour (ring == 4 ? grid.brighter (0.18f) : grid);
            g.drawEllipse (circle, ring == 4 ? 1.4f : 0.8f);
        }

        for (auto sector = 0; sector < 16; ++sector)
        {
            const auto angleValue = static_cast<float> (sector) / 16.0f * twoPi;
            const auto direction = juce::Point<float> (std::sin (angleValue), -std::cos (angleValue));
            g.setColour (sector % 4 == 0 ? grid.brighter (0.20f) : grid.withAlpha (0.56f));
            g.drawLine ({ centre, centre + direction * radius }, sector % 4 == 0 ? 1.1f : 0.65f);
        }

        g.setFont (dataFont (8.0f));
        g.setColour (muted);
        g.drawText ("FRONT / 00°", juce::Rectangle<float> (centre.x - 55.0f, square.getY() - 17.0f, 110.0f, 14.0f), juce::Justification::centred);
        g.drawText ("REAR / 180°", juce::Rectangle<float> (centre.x - 55.0f, square.getBottom() + 3.0f, 110.0f, 14.0f), juce::Justification::centred);
        g.drawText ("L", juce::Rectangle<float> (square.getX() - 18.0f, centre.y - 8.0f, 14.0f, 16.0f), juce::Justification::centred);
        g.drawText ("R", juce::Rectangle<float> (square.getRight() + 4.0f, centre.y - 8.0f, 14.0f, 16.0f), juce::Justification::centred);

        const auto activeStep = processor.getCurrentStep();
        for (auto step = 0; step < 16; ++step)
        {
            const auto ring = juce::roundToInt (
                processor.parameters.getRawParameterValue (stepId (step))->load());
            if (ring <= 0)
                continue;

            const auto angleValue = (static_cast<float> (step) + 0.5f) / 16.0f * twoPi;
            const auto ringDistance = (static_cast<float> (ring) - 0.5f) / 4.0f;
            const auto point = centre + juce::Point<float> (std::sin (angleValue), -std::cos (angleValue))
                * radius * ringDistance;
            const auto active = step == activeStep;
            g.setColour (active ? phosphor : phosphorDim);
            g.fillEllipse (juce::Rectangle<float> (active ? 13.0f : 9.0f,
                                                    active ? 13.0f : 9.0f).withCentre (point));
            if (active)
            {
                g.setColour (phosphor.withAlpha (0.25f));
                g.fillEllipse (juce::Rectangle<float> (28.0f, 28.0f).withCentre (point));
            }
        }

        const auto phase = processor.getSweepPhase();
        const auto sweepAngle = phase * twoPi;
        const auto sweepDirection = juce::Point<float> (std::sin (sweepAngle), -std::cos (sweepAngle));
        juce::ColourGradient beam (phosphor.withAlpha (0.58f), centre.x, centre.y,
                                   phosphor.withAlpha (0.0f),
                                   centre.x + sweepDirection.x * radius,
                                   centre.y + sweepDirection.y * radius,
                                   false);
        g.setGradientFill (beam);
        juce::Path wedge;
        wedge.addPieSegment (square, sweepAngle - 0.18f, sweepAngle, 0.0f);
        g.fillPath (wedge);
        g.setColour (phosphor);
        g.drawLine ({ centre, centre + sweepDirection * radius }, 1.8f);

        const auto objectAngleValue = processor.getObjectAngle() * twoPi;
        const auto objectDistanceValue = processor.getObjectDistance();
        const auto objectPoint = centre
            + juce::Point<float> (std::sin (objectAngleValue), -std::cos (objectAngleValue))
            * radius * objectDistanceValue;
        const auto pulse = processor.getEncounterPulse();
        g.setColour (phosphor.withAlpha (0.14f + pulse * 0.30f));
        g.fillEllipse (juce::Rectangle<float> (28.0f + pulse * 28.0f,
                                               28.0f + pulse * 28.0f).withCentre (objectPoint));
        g.setColour (paper);
        g.fillEllipse (juce::Rectangle<float> (11.0f, 11.0f).withCentre (objectPoint));
        g.setColour (phosphor);
        g.drawEllipse (juce::Rectangle<float> (15.0f, 15.0f).withCentre (objectPoint), 2.0f);

        g.setColour (panelRaised);
        g.fillEllipse (juce::Rectangle<float> (28.0f, 28.0f).withCentre (centre));
        g.setColour (phosphor);
        g.drawEllipse (juce::Rectangle<float> (28.0f, 28.0f).withCentre (centre), 1.5f);
        g.fillEllipse (juce::Rectangle<float> (5.0f, 5.0f).withCentre (centre));

        const auto modeIndex = juce::roundToInt (processor.parameters.getRawParameterValue ("mode")->load());
        const juce::String modeNames[] { "STATIC", "ORBIT", "SEQUENCE" };
        auto statusArea = bounds.reduced (12.0f);
        statusArea = statusArea.removeFromTop (18.0f);
        g.setFont (dataFont (9.0f));
        g.setColour (phosphor);
        g.drawText (modeNames[juce::jlimit (0, 2, modeIndex)] + " / STEP "
                    + juce::String (activeStep + 1).paddedLeft ('0', 2),
                    statusArea,
                    juce::Justification::centredRight);
    }

    void mouseDown (const juce::MouseEvent& event) override { placeAt (event.position); }
    void mouseDrag (const juce::MouseEvent& event) override { placeAt (event.position); }

private:
    void timerCallback() override { repaint(); }

    void placeAt (juce::Point<float> point)
    {
        const auto bounds = getLocalBounds().toFloat();
        const auto fieldSize = juce::jmin (bounds.getWidth() - 44.0f, bounds.getHeight() - 44.0f);
        const auto square = bounds.reduced (22.0f).withSizeKeepingCentre (fieldSize, fieldSize);
        const auto centre = square.getCentre();
        const auto radius = square.getWidth() * 0.5f;
        const auto vector = point - centre;
        const auto radial = juce::jlimit (0.0f, 1.0f, vector.getDistanceFromOrigin() / radius);
        auto angleValue = std::atan2 (vector.x, -vector.y) / twoPi;
        if (angleValue < 0.0f)
            angleValue += 1.0f;

        const auto modeIndex = juce::roundToInt (
            processor.parameters.getRawParameterValue ("mode")->load());
        if (modeIndex == 2)
        {
            const auto step = juce::jlimit (0, 15, static_cast<int> (std::floor (angleValue * 16.0f)));
            const auto ring = juce::jlimit (1, 4, static_cast<int> (std::ceil (radial * 4.0f)));
            const auto currentRing = juce::roundToInt (
                processor.parameters.getRawParameterValue (stepId (step))->load());
            setStep (step, currentRing == ring ? 0 : ring);
            return;
        }

        if (auto* distanceParameter = processor.parameters.getParameter ("distance"))
            distanceParameter->setValueNotifyingHost (distanceParameter->convertTo0to1 (radial * 100.0f));

        if (modeIndex == 0)
            if (auto* angleParameter = processor.parameters.getParameter ("angle"))
                angleParameter->setValueNotifyingHost (angleParameter->convertTo0to1 (angleValue * 360.0f));
    }

    SonarAudioProcessor& processor;
    std::function<void (int, int)> setStep;
};

SonarAudioProcessorEditor::SonarAudioProcessorEditor (SonarAudioProcessor& owner)
    : AudioProcessorEditor (&owner), processor (owner)
{
    lookAndFeel = std::make_unique<SonarLookAndFeel>();
    setLookAndFeel (lookAndFeel.get());
    setOpaque (true);
    setResizable (true, true);
    setResizeLimits (900, 650, 1600, 1050);

    radar = std::make_unique<RadarComponent> (processor,
        [this] (int step, int ring) { setStepRing (step, ring); });
    addAndMakeVisible (*radar);

    mode = std::make_unique<ChoiceControl> (processor.parameters, "mode", "MOTION MODE",
        juce::StringArray { "STATIC", "ORBIT", "SEQUENCE" });
    cycle = std::make_unique<ChoiceControl> (processor.parameters, "cycleBars", "ONE ROTATION",
        juce::StringArray { "1 BAR", "2 BARS", "4 BARS", "8 BARS" });
    monitor = std::make_unique<ChoiceControl> (processor.parameters, "monitor", "PLAYBACK FIELD",
        juce::StringArray { "SPEAKERS", "HEADPHONES" });
    clockwise = std::make_unique<ToggleControl> (processor.parameters, "clockwise", "CLOCKWISE SWEEP");
    angle = std::make_unique<KnobControl> (processor.parameters, "angle", "ANGLE", "°");
    distance = std::make_unique<KnobControl> (processor.parameters, "distance", "DISTANCE", "%");
    smoothing = std::make_unique<KnobControl> (processor.parameters, "smooth", "GLIDE", "%");
    rear = std::make_unique<KnobControl> (processor.parameters, "rear", "REAR CUE", "%");
    space = std::make_unique<KnobControl> (processor.parameters, "space", "SPACE", "%");
    mix = std::make_unique<KnobControl> (processor.parameters, "mix", "MIX", "%");
    input = std::make_unique<KnobControl> (processor.parameters, "input", "INPUT", " dB");
    output = std::make_unique<KnobControl> (processor.parameters, "output", "OUTPUT", " dB");

    for (auto* component : std::vector<juce::Component*> {
        mode.get(), cycle.get(), monitor.get(), clockwise.get(), angle.get(), distance.get(),
        smoothing.get(), rear.get(), space.get(), mix.get(), input.get(), output.get() })
        addAndMakeVisible (*component);

    clearButton.onClick = [this] { clearSequence(); };
    quartersButton.onClick = [this] { loadPattern (0); };
    backbeatButton.onClick = [this] { loadPattern (1); };
    perimeterButton.onClick = [this] { loadPattern (2); };
    addAndMakeVisible (clearButton);
    addAndMakeVisible (quartersButton);
    addAndMakeVisible (backbeatButton);
    addAndMakeVisible (perimeterButton);

    setSize (1120, 760);
    startTimerHz (12);
}

SonarAudioProcessorEditor::~SonarAudioProcessorEditor()
{
    setLookAndFeel (nullptr);
}

void SonarAudioProcessorEditor::paint (juce::Graphics& g)
{
    g.fillAll (voidColour);

    const auto width = getWidth();
    g.setColour (phosphor);
    g.fillRect (20, 20, 66, 62);
    g.setColour (voidColour);
    g.setFont (dataFont (11.0f));
    g.drawFittedText ("MZ-05", juce::Rectangle<int> (20, 20, 66, 62), juce::Justification::centred, 1);

    g.setColour (paper);
    g.setFont (displayFont (58.0f));
    g.drawFittedText ("SONAR", juce::Rectangle<int> (102, 13, width - 420, 58),
                      juce::Justification::centredLeft, 1);
    g.setColour (muted);
    g.setFont (dataFont (9.0f));
    g.drawText ("STEREO SPATIAL SEQUENCER / ANGLE × DISTANCE × TIME",
                juce::Rectangle<int> (105, 66, width - 440, 18),
                juce::Justification::centredLeft);

    const auto running = processor.getTransportRunning();
    g.setColour (running ? phosphor : muted);
    g.setFont (dataFont (9.0f));
    g.drawFittedText (running ? "HOST TRANSPORT / RUNNING" : "HOST TRANSPORT / STANDBY",
                      juce::Rectangle<int> (width - 300, 25, 280, 22),
                      juce::Justification::centredRight, 1);
    g.setColour (muted);
    g.drawFittedText ("FRONT = 00° / RIGHT = 90° / REAR = 180° / LEFT = 270°",
                      juce::Rectangle<int> (width - 470, 53, 450, 18),
                      juce::Justification::centredRight, 1);

    g.setColour (grid);
    g.drawRect (radarPanel, 1);
    g.drawRect (controlPanel, 1);

    g.setColour (paper);
    g.setFont (dataFont (9.0f));
    auto radarHeader = radarPanel;
    auto controlHeader = controlPanel;
    g.drawText ("01 / SPATIAL FIELD", radarHeader.removeFromTop (28).reduced (10, 0),
                juce::Justification::centredLeft);
    g.drawText ("02 / RESPONSE CONTROLS", controlHeader.removeFromTop (28).reduced (10, 0),
                juce::Justification::centredLeft);

    g.setColour (muted);
    g.setFont (dataFont (8.0f));
    g.drawText ("SEQUENCE MODE: CLICK A SECTOR + RING TO PLACE OR REMOVE A POSITION EVENT.",
                juce::Rectangle<int> (20, getHeight() - 30, width - 40, 16),
                juce::Justification::centredLeft);
}

void SonarAudioProcessorEditor::resized()
{
    const auto width = getWidth();
    const auto height = getHeight();
    const auto content = juce::Rectangle<int> (20, 96, width - 40, height - 142);
    const auto controlsWidth = juce::jlimit (330, 460, content.getWidth() * 36 / 100);
    radarPanel = content.withTrimmedRight (controlsWidth + 8);
    controlPanel = content.withTrimmedLeft (content.getWidth() - controlsWidth);

    radar->setBounds (radarPanel.reduced (10).withTrimmedTop (22));

    auto controls = controlPanel.reduced (10).withTrimmedTop (28);
    const auto topHeight = 58;
    auto topRow = controls.removeFromTop (topHeight);
    const auto third = topRow.getWidth() / 3;
    mode->setBounds (topRow.removeFromLeft (third).reduced (3));
    cycle->setBounds (topRow.removeFromLeft (third).reduced (3));
    monitor->setBounds (topRow.reduced (3));

    clockwise->setBounds (controls.removeFromTop (46).reduced (3));

    auto knobArea = controls.removeFromTop (juce::jmin (controls.getHeight() - 90, 330));
    const auto knobWidth = knobArea.getWidth() / 3;
    const auto knobHeight = knobArea.getHeight() / 3;
    std::array<KnobControl*, 9> knobs {
        angle.get(), distance.get(), smoothing.get(), rear.get(), space.get(), mix.get(),
        input.get(), output.get(), nullptr
    };
    for (auto row = 0; row < 3; ++row)
        for (auto column = 0; column < 3; ++column)
            if (auto* knob = knobs[static_cast<size_t> (row * 3 + column)])
                knob->setBounds (knobArea.getX() + column * knobWidth,
                                 knobArea.getY() + row * knobHeight,
                                 knobWidth,
                                 knobHeight);

    auto patterns = controls.removeFromBottom (82);
    auto patternTop = patterns.removeFromTop (patterns.getHeight() / 2);
    clearButton.setBounds (patternTop.removeFromLeft (patternTop.getWidth() / 2).reduced (3));
    quartersButton.setBounds (patternTop.reduced (3));
    backbeatButton.setBounds (patterns.removeFromLeft (patterns.getWidth() / 2).reduced (3));
    perimeterButton.setBounds (patterns.reduced (3));
}

void SonarAudioProcessorEditor::timerCallback()
{
    repaint();
}

void SonarAudioProcessorEditor::setStepRing (int step, int ring)
{
    if (auto* parameter = processor.parameters.getParameter (stepId (step)))
    {
        parameter->beginChangeGesture();
        parameter->setValueNotifyingHost (parameter->convertTo0to1 (static_cast<float> (ring)));
        parameter->endChangeGesture();
    }
}

void SonarAudioProcessorEditor::clearSequence()
{
    for (auto step = 0; step < 16; ++step)
        setStepRing (step, 0);
}

void SonarAudioProcessorEditor::loadPattern (int pattern)
{
    clearSequence();
    if (pattern == 0)
    {
        setStepRing (0, 1);
        setStepRing (4, 2);
        setStepRing (8, 3);
        setStepRing (12, 4);
    }
    else if (pattern == 1)
    {
        setStepRing (4, 2);
        setStepRing (12, 4);
    }
    else
    {
        setStepRing (1, 4);
        setStepRing (5, 4);
        setStepRing (9, 4);
        setStepRing (13, 4);
    }
}

juce::AudioProcessorEditor* SonarAudioProcessor::createEditor()
{
    return new SonarAudioProcessorEditor (*this);
}
