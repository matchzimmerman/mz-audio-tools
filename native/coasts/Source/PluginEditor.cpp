#include "PluginEditor.h"

#include <algorithm>

namespace
{
const auto paper = juce::Colour (0xffeee9dc);
const auto paperDeep = juce::Colour (0xffd5d0c4);
const auto paperLight = juce::Colour (0xfffaf6eb);
const auto ink = juce::Colour (0xff1d1d1b);
const auto signal = juce::Colour (0xffdfff00);
const auto muted = juce::Colour (0xff77756e);
const auto line = juce::Colour (0x521d1d1b);

juce::Font displayFont (float size)
{
    return juce::Font (juce::Font::getDefaultSansSerifFontName(), size, juce::Font::bold);
}

juce::Font dataFont (float size)
{
    return juce::Font (juce::Font::getDefaultMonospacedFontName(), size, juce::Font::bold);
}
}

class CoastsAudioProcessorEditor::FieldLookAndFeel final : public juce::LookAndFeel_V4
{
public:
    FieldLookAndFeel()
    {
        setColour (juce::Slider::textBoxTextColourId, ink);
        setColour (juce::Slider::textBoxBackgroundColourId, paperLight);
        setColour (juce::Slider::textBoxOutlineColourId, ink);
        setColour (juce::Slider::rotarySliderFillColourId, signal);
        setColour (juce::Slider::rotarySliderOutlineColourId, ink);
        setColour (juce::TextButton::buttonColourId, paper);
        setColour (juce::TextButton::buttonOnColourId, signal);
        setColour (juce::TextButton::textColourOffId, ink);
        setColour (juce::TextButton::textColourOnId, ink);
        setColour (juce::ComboBox::backgroundColourId, paperLight);
        setColour (juce::ComboBox::outlineColourId, ink);
        setColour (juce::ComboBox::textColourId, ink);
        setColour (juce::ComboBox::arrowColourId, ink);
        setColour (juce::PopupMenu::backgroundColourId, paperLight);
        setColour (juce::PopupMenu::textColourId, ink);
        setColour (juce::PopupMenu::highlightedBackgroundColourId, signal);
        setColour (juce::PopupMenu::highlightedTextColourId, ink);
        setColour (juce::Label::textColourId, ink);
        setColour (juce::ToggleButton::textColourId, ink);
    }

    void drawRotarySlider (juce::Graphics& g, int x, int y, int width, int height,
                           float position, float startAngle, float endAngle,
                           juce::Slider&) override
    {
        const auto bounds = juce::Rectangle<float> (static_cast<float> (x),
                                                     static_cast<float> (y),
                                                     static_cast<float> (width),
                                                     static_cast<float> (height)).reduced (10.0f);
        const auto radius = juce::jmin (bounds.getWidth(), bounds.getHeight()) * 0.5f;
        const auto centre = bounds.getCentre();
        const auto knob = juce::Rectangle<float> (radius * 2.0f, radius * 2.0f).withCentre (centre);
        const auto angle = startAngle + position * (endAngle - startAngle);

        g.setColour (line);
        for (auto tick = 0; tick <= 20; ++tick)
        {
            const auto tickAngle = startAngle + (endAngle - startAngle) * static_cast<float> (tick) / 20.0f;
            const auto outside = centre + juce::Point<float> (std::sin (tickAngle), -std::cos (tickAngle)) * (radius + 5.0f);
            const auto inside = centre + juce::Point<float> (std::sin (tickAngle), -std::cos (tickAngle)) * (radius + 1.0f);
            g.drawLine ({ inside, outside }, 1.0f);
        }

        g.setColour (paperLight);
        g.fillEllipse (knob);
        g.setColour (ink);
        g.drawEllipse (knob, 1.5f);

        juce::Path activeArc;
        activeArc.addCentredArc (centre.x, centre.y, radius - 4.0f, radius - 4.0f,
                                 0.0f, startAngle, angle, true);
        g.setColour (signal);
        g.strokePath (activeArc, juce::PathStrokeType (4.0f));

        const auto pointerLength = radius * 0.65f;
        const auto pointer = juce::Point<float> (std::sin (angle), -std::cos (angle)) * pointerLength;
        g.setColour (ink);
        g.drawLine ({ centre, centre + pointer }, 3.0f);
        g.fillEllipse (juce::Rectangle<float> (5.0f, 5.0f).withCentre (centre));
    }

    void drawButtonBackground (juce::Graphics& g, juce::Button& button,
                               const juce::Colour&, bool highlighted, bool down) override
    {
        const auto selected = button.getToggleState() || down;
        g.setColour (selected || highlighted ? signal : paper);
        g.fillRect (button.getLocalBounds());
        g.setColour (ink);
        g.drawRect (button.getLocalBounds(), 1);

        if (button.hasKeyboardFocus (true))
        {
            g.setColour (signal);
            g.drawRect (button.getLocalBounds().reduced (3), 3);
        }
    }

    void drawButtonText (juce::Graphics& g, juce::TextButton& button,
                         bool, bool) override
    {
        g.setColour (ink);
        g.setFont (dataFont (10.0f));
        g.drawFittedText (button.getButtonText(), button.getLocalBounds().reduced (8, 4),
                          juce::Justification::centred, 2);
    }

    void drawComboBox (juce::Graphics& g, int width, int height, bool,
                       int, int, int, int, juce::ComboBox&) override
    {
        g.setColour (paperLight);
        g.fillRect (0, 0, width, height);
        g.setColour (ink);
        g.drawRect (0, 0, width, height, 1);

        juce::Path arrow;
        arrow.addTriangle (static_cast<float> (width - 20), static_cast<float> (height / 2 - 3),
                           static_cast<float> (width - 10), static_cast<float> (height / 2 - 3),
                           static_cast<float> (width - 15), static_cast<float> (height / 2 + 4));
        g.fillPath (arrow);
    }

    juce::Font getComboBoxFont (juce::ComboBox&) override
    {
        return dataFont (10.0f);
    }

    void drawToggleButton (juce::Graphics& g, juce::ToggleButton& button,
                           bool highlighted, bool down) override
    {
        const auto bounds = button.getLocalBounds();
        const auto box = bounds.removeFromLeft (44).reduced (2);
        g.setColour (button.getToggleState() || highlighted || down ? signal : paperLight);
        g.fillRect (box);
        g.setColour (ink);
        g.drawRect (box, 1);
        if (button.getToggleState())
        {
            g.drawLine (static_cast<float> (box.getX() + 9), static_cast<float> (box.getCentreY()),
                        static_cast<float> (box.getCentreX() - 1), static_cast<float> (box.getBottom() - 9), 2.0f);
            g.drawLine (static_cast<float> (box.getCentreX() - 1), static_cast<float> (box.getBottom() - 9),
                        static_cast<float> (box.getRight() - 8), static_cast<float> (box.getY() + 8), 2.0f);
        }

        g.setFont (dataFont (10.0f));
        g.drawFittedText (button.getButtonText(), bounds.reduced (8, 0),
                          juce::Justification::centredLeft, 2);
    }
};

class CoastsAudioProcessorEditor::KnobControl final : public juce::Component
{
public:
    KnobControl (juce::AudioProcessorValueTreeState& state,
                 const juce::String& parameterId,
                 const juce::String& title)
        : attachment (state, parameterId, slider)
    {
        label.setText (title, juce::dontSendNotification);
        label.setFont (dataFont (9.0f));
        label.setJustificationType (juce::Justification::centred);
        addAndMakeVisible (label);

        slider.setSliderStyle (juce::Slider::RotaryHorizontalVerticalDrag);
        slider.setTextBoxStyle (juce::Slider::TextBoxBelow, false, 72, 20);
        slider.setMouseDragSensitivity (180);
        addAndMakeVisible (slider);
    }

    void resized() override
    {
        auto area = getLocalBounds();
        label.setBounds (area.removeFromTop (20));
        slider.setBounds (area);
    }

private:
    juce::Label label;
    juce::Slider slider;
    juce::AudioProcessorValueTreeState::SliderAttachment attachment;
};

class CoastsAudioProcessorEditor::ChoiceControl final : public juce::Component
{
public:
    ChoiceControl (juce::AudioProcessorValueTreeState& state,
                   const juce::String& parameterId,
                   const juce::String& title,
                   const juce::StringArray& choices)
        : attachment (state, parameterId, combo)
    {
        label.setText (title, juce::dontSendNotification);
        label.setFont (dataFont (9.0f));
        addAndMakeVisible (label);

        combo.addItemList (choices, 1);
        combo.setJustificationType (juce::Justification::centredLeft);
        addAndMakeVisible (combo);
    }

    void resized() override
    {
        auto area = getLocalBounds();
        label.setBounds (area.removeFromTop (18));
        combo.setBounds (area.removeFromTop (38));
    }

private:
    juce::Label label;
    juce::ComboBox combo;
    juce::AudioProcessorValueTreeState::ComboBoxAttachment attachment;
};

class CoastsAudioProcessorEditor::ToggleControl final : public juce::Component
{
public:
    ToggleControl (juce::AudioProcessorValueTreeState& state,
                   const juce::String& parameterId,
                   const juce::String& title)
        : attachment (state, parameterId, button)
    {
        label.setText ("FUNCTION STATE", juce::dontSendNotification);
        label.setFont (dataFont (9.0f));
        addAndMakeVisible (label);

        button.setButtonText (title);
        addAndMakeVisible (button);
    }

    void resized() override
    {
        auto area = getLocalBounds();
        label.setBounds (area.removeFromTop (18));
        button.setBounds (area.removeFromTop (48));
    }

private:
    juce::Label label;
    juce::ToggleButton button;
    juce::AudioProcessorValueTreeState::ButtonAttachment attachment;
};

class CoastsAudioProcessorEditor::OutputTrace final : public juce::Component,
                                                       private juce::Timer
{
public:
    explicit OutputTrace (CoastsAudioProcessor& owner) : processor (owner)
    {
        history.fill (0.0f);
        startTimerHz (30);
    }

    void paint (juce::Graphics& g) override
    {
        auto bounds = getLocalBounds();
        g.setColour (paperLight);
        g.fillRect (bounds);
        g.setColour (ink);
        g.drawRect (bounds, 1);

        g.setColour (line);
        for (auto x = bounds.getX() + bounds.getWidth() / 8; x < bounds.getRight(); x += bounds.getWidth() / 8)
            g.drawVerticalLine (x, static_cast<float> (bounds.getY()), static_cast<float> (bounds.getBottom()));
        for (auto y = bounds.getY() + bounds.getHeight() / 4; y < bounds.getBottom(); y += bounds.getHeight() / 4)
            g.drawHorizontalLine (y, static_cast<float> (bounds.getX()), static_cast<float> (bounds.getRight()));

        g.setColour (muted);
        g.setFont (dataFont (9.0f));
        g.drawText ("LIVE OUTPUT / BLOCK ENERGY", bounds.reduced (10).removeFromTop (18),
                    juce::Justification::centredLeft);

        juce::Path path;
        const auto plot = bounds.toFloat().reduced (8.0f, 24.0f);
        for (size_t index = 0; index < history.size(); ++index)
        {
            const auto x = plot.getX() + plot.getWidth()
                * static_cast<float> (index) / static_cast<float> (history.size() - 1);
            const auto y = plot.getBottom() - history[index] * plot.getHeight();
            if (index == 0)
                path.startNewSubPath (x, y);
            else
                path.lineTo (x, y);
        }

        g.setColour (processor.getActiveMidiNote() >= 0 ? signal : ink);
        g.strokePath (path, juce::PathStrokeType (2.0f));
    }

private:
    void timerCallback() override
    {
        std::move (history.begin() + 1, history.end(), history.begin());
        history.back() = juce::jlimit (0.0f, 1.0f, processor.getOutputLevel() * 1.8f);
        repaint();
    }

    CoastsAudioProcessor& processor;
    std::array<float, 180> history;
};

CoastsAudioProcessorEditor::CoastsAudioProcessorEditor (CoastsAudioProcessor& owner)
    : AudioProcessorEditor (&owner), processor (owner)
{
    fieldLookAndFeel = std::make_unique<FieldLookAndFeel>();
    setLookAndFeel (fieldLookAndFeel.get());
    setOpaque (true);
    setResizable (true, true);
    setResizeLimits (820, 620, 1500, 980);
    setSize (1040, 720);

    eastButton.setClickingTogglesState (false);
    westButton.setClickingTogglesState (false);
    eastButton.onClick = [this] { setMode (0); };
    westButton.onClick = [this] { setMode (1); };
    addAndMakeVisible (eastButton);
    addAndMakeVisible (westButton);

    outputTrace = std::make_unique<OutputTrace> (processor);
    addAndMakeVisible (*outputTrace);

    masterGain = std::make_unique<KnobControl> (processor.parameters, "masterGain", "OUTPUT / dB");
    addAndMakeVisible (*masterGain);

    eastOsc1 = std::make_unique<ChoiceControl> (processor.parameters, "eastOsc1", "OSCILLATOR 1",
                                                juce::StringArray { "SAW", "PULSE", "TRIANGLE" });
    eastOsc2 = std::make_unique<ChoiceControl> (processor.parameters, "eastOsc2", "OSCILLATOR 2",
                                                juce::StringArray { "SAW", "PULSE", "TRIANGLE" });
    eastDetune = std::make_unique<KnobControl> (processor.parameters, "eastDetune", "DETUNE / CENTS");
    eastBalance = std::make_unique<KnobControl> (processor.parameters, "eastBalance", "BALANCE");
    eastCutoff = std::make_unique<KnobControl> (processor.parameters, "eastCutoff", "CUTOFF");
    eastResonance = std::make_unique<KnobControl> (processor.parameters, "eastResonance", "RESONANCE");
    eastFilterEnv = std::make_unique<KnobControl> (processor.parameters, "eastFilterEnv", "ENV AMOUNT");
    eastAttack = std::make_unique<KnobControl> (processor.parameters, "eastAttack", "ATTACK");
    eastDecay = std::make_unique<KnobControl> (processor.parameters, "eastDecay", "DECAY");
    eastSustain = std::make_unique<KnobControl> (processor.parameters, "eastSustain", "SUSTAIN");
    eastRelease = std::make_unique<KnobControl> (processor.parameters, "eastRelease", "RELEASE");

    eastComponents = { eastOsc1.get(), eastOsc2.get(), eastDetune.get(), eastBalance.get(),
                       eastCutoff.get(), eastResonance.get(), eastFilterEnv.get(), eastAttack.get(),
                       eastDecay.get(), eastSustain.get(), eastRelease.get() };

    westRatio = std::make_unique<ChoiceControl> (processor.parameters, "westRatio", "MODULATION RATIO",
                                                 juce::StringArray { "0.5:1", "1:1", "1.5:1", "2:1", "3:1", "4:1" });
    westFm = std::make_unique<KnobControl> (processor.parameters, "westFm", "FM INDEX");
    westFold = std::make_unique<KnobControl> (processor.parameters, "westFold", "FOLD");
    westSymmetry = std::make_unique<KnobControl> (processor.parameters, "westSymmetry", "SYMMETRY");
    westUncertainty = std::make_unique<KnobControl> (processor.parameters, "westUncertainty", "UNCERTAINTY");
    westRise = std::make_unique<KnobControl> (processor.parameters, "westRise", "RISE");
    westFall = std::make_unique<KnobControl> (processor.parameters, "westFall", "FALL");
    westLoop = std::make_unique<ToggleControl> (processor.parameters, "westLoop", "CYCLER / LOOP");
    westColor = std::make_unique<KnobControl> (processor.parameters, "westColor", "COLOR");
    westRing = std::make_unique<KnobControl> (processor.parameters, "westRing", "RING");

    westComponents = { westRatio.get(), westFm.get(), westFold.get(), westSymmetry.get(),
                       westUncertainty.get(), westRise.get(), westFall.get(), westLoop.get(),
                       westColor.get(), westRing.get() };

    for (auto* component : eastComponents)
        addAndMakeVisible (*component);
    for (auto* component : westComponents)
        addAndMakeVisible (*component);

    updateModeVisibility();
    startTimerHz (15);
}

CoastsAudioProcessorEditor::~CoastsAudioProcessorEditor()
{
    setLookAndFeel (nullptr);
}

void CoastsAudioProcessorEditor::paint (juce::Graphics& g)
{
    g.fillAll (paper);

    const auto width = getWidth();
    auto masthead = juce::Rectangle<int> (20, 18, width - 40, 80);
    g.setColour (ink);
    g.fillRect (masthead.removeFromTop (2));
    g.fillRect (masthead.removeFromBottom (2));

    auto plate = juce::Rectangle<int> (20, 30, 62, 54);
    g.setColour (signal);
    g.fillRect (plate);
    g.setColour (ink);
    g.drawRect (plate, 1);
    g.setFont (dataFont (12.0f));
    g.drawFittedText ("MZ-04", plate, juce::Justification::centred, 1);

    g.setFont (displayFont (52.0f));
    g.drawFittedText ("COASTS", { 96, 22, width - 260, 52 },
                      juce::Justification::centredLeft, 1);
    g.setFont (dataFont (10.0f));
    g.drawText ("DUAL SYNTHESIS PHILOSOPHY / EAST ↔ WEST / NATIVE UNIT 0.1",
                { 99, 73, width - 280, 18 }, juce::Justification::centredLeft);

    const auto mode = juce::roundToInt (processor.parameters.getRawParameterValue ("mode")->load());
    const auto note = processor.getActiveMidiNote();
    const auto level = juce::jlimit (0, 100, juce::roundToInt (processor.getOutputLevel() * 100.0f));

    auto registerBounds = juce::Rectangle<int> (20, 310, width - 40, 54);
    g.setColour (ink);
    g.drawRect (registerBounds, 1);
    const auto cellWidth = registerBounds.getWidth() / 4;
    const juce::String values[] {
        mode == 0 ? "SUBTRACTIVE" : "COMPLEX TIMBRE",
        mode == 0 ? "VCO ×2 → VCF ×2 → VCA" : "MOD → FOLDER → LPG",
        note >= 0 ? juce::MidiMessage::getMidiNoteName (note, true, true, 3) : "AWAITING MIDI",
        juce::String (level).paddedLeft ('0', 3) + "%"
    };
    const juce::String labels[] { "METHOD", "ACTIVE SIGNAL PATH", "CURRENT NOTE", "OUTPUT LEVEL" };

    for (auto index = 0; index < 4; ++index)
    {
        auto cell = juce::Rectangle<int> (registerBounds.getX() + index * cellWidth,
                                          registerBounds.getY(), cellWidth,
                                          registerBounds.getHeight());
        if (index > 0)
            g.drawVerticalLine (cell.getX(), static_cast<float> (cell.getY()), static_cast<float> (cell.getBottom()));
        g.setColour (muted);
        g.setFont (dataFont (8.5f));
        g.drawText (labels[index], cell.reduced (10).removeFromTop (18), juce::Justification::centredLeft);
        g.setColour (ink);
        g.setFont (dataFont (11.0f));
        g.drawFittedText (values[index], cell.reduced (10).withTrimmedTop (18),
                          juce::Justification::centredLeft, 1);
    }

    if (mode == 0)
    {
        drawModule (g, moduleBounds[0], "01", "SOURCE", "HARMONIC MATERIAL", "VCO");
        drawModule (g, moduleBounds[1], "02", "FILTER", "SUBTRACTIVE SCULPTURE", "VCF");
        drawModule (g, moduleBounds[2], "03", "CONTOUR", "KEYED AMPLITUDE SHAPE", "ADSR");
    }
    else
    {
        drawModule (g, moduleBounds[0], "01", "COMPLEX OSC", "HARMONICS GENERATED INSIDE", "259");
        drawModule (g, moduleBounds[1], "02", "FUNCTION", "RISE / FALL VOLTAGE", "281");
        drawModule (g, moduleBounds[2], "03", "DYNAMICS", "TONE + AMPLITUDE TOGETHER", "LPG");
    }

    g.setColour (muted);
    g.setFont (dataFont (8.5f));
    g.drawText ("MZ AUDIO LAB / VST3 + AU + STANDALONE / MIDI IN / MONOPHONIC SIGNAL PATH",
                { 20, getHeight() - 28, width - 40, 16 }, juce::Justification::centredLeft);
}

void CoastsAudioProcessorEditor::resized()
{
    const auto width = getWidth();
    eastButton.setBounds (20, 106, (width - 40) / 2, 48);
    westButton.setBounds (20 + (width - 40) / 2, 106, (width - 40) / 2, 48);
    outputTrace->setBounds (20, 162, width - 40, 140);
    masterGain->setBounds (width - 142, 22, 106, 72);

    auto modules = juce::Rectangle<int> (20, 372, width - 40, getHeight() - 414);
    const auto gap = 6;
    const auto columnWidth = (modules.getWidth() - gap * 2) / 3;
    moduleBounds[0] = modules.removeFromLeft (columnWidth);
    modules.removeFromLeft (gap);
    moduleBounds[1] = modules.removeFromLeft (columnWidth);
    modules.removeFromLeft (gap);
    moduleBounds[2] = modules;

    if (visibleMode == 0)
        layoutEastControls ({ 20, 372, width - 40, getHeight() - 414 });
    else
        layoutWestControls ({ 20, 372, width - 40, getHeight() - 414 });
}

void CoastsAudioProcessorEditor::timerCallback()
{
    updateModeVisibility();
    repaint();
}

void CoastsAudioProcessorEditor::setMode (int modeIndex)
{
    if (auto* parameter = processor.parameters.getParameter ("mode"))
    {
        parameter->beginChangeGesture();
        parameter->setValueNotifyingHost (static_cast<float> (modeIndex));
        parameter->endChangeGesture();
    }
}

void CoastsAudioProcessorEditor::updateModeVisibility()
{
    const auto mode = juce::roundToInt (processor.parameters.getRawParameterValue ("mode")->load());
    if (mode == visibleMode)
        return;

    visibleMode = mode;
    eastButton.setToggleState (mode == 0, juce::dontSendNotification);
    westButton.setToggleState (mode == 1, juce::dontSendNotification);

    for (auto* component : eastComponents)
        component->setVisible (mode == 0);
    for (auto* component : westComponents)
        component->setVisible (mode == 1);

    resized();
    repaint();
}

void CoastsAudioProcessorEditor::layoutEastControls (juce::Rectangle<int>)
{
    auto source = moduleBounds[0].reduced (12).withTrimmedTop (62);
    auto sourceChoices = source.removeFromTop (62);
    eastOsc1->setBounds (sourceChoices.removeFromLeft (sourceChoices.getWidth() / 2).reduced (3));
    eastOsc2->setBounds (sourceChoices.reduced (3));
    eastDetune->setBounds (source.removeFromLeft (source.getWidth() / 2).reduced (3));
    eastBalance->setBounds (source.reduced (3));

    auto filter = moduleBounds[1].reduced (10).withTrimmedTop (62);
    const auto filterWidth = filter.getWidth() / 3;
    eastCutoff->setBounds (filter.removeFromLeft (filterWidth).reduced (2));
    eastResonance->setBounds (filter.removeFromLeft (filterWidth).reduced (2));
    eastFilterEnv->setBounds (filter.reduced (2));

    auto contour = moduleBounds[2].reduced (10).withTrimmedTop (62);
    auto top = contour.removeFromTop (contour.getHeight() / 2);
    eastAttack->setBounds (top.removeFromLeft (top.getWidth() / 2).reduced (2));
    eastDecay->setBounds (top.reduced (2));
    eastSustain->setBounds (contour.removeFromLeft (contour.getWidth() / 2).reduced (2));
    eastRelease->setBounds (contour.reduced (2));
}

void CoastsAudioProcessorEditor::layoutWestControls (juce::Rectangle<int>)
{
    auto complex = moduleBounds[0].reduced (10).withTrimmedTop (62);
    westRatio->setBounds (complex.removeFromTop (60).reduced (2));
    auto complexTop = complex.removeFromTop (complex.getHeight() / 2);
    westFm->setBounds (complexTop.removeFromLeft (complexTop.getWidth() / 2).reduced (2));
    westFold->setBounds (complexTop.reduced (2));
    westSymmetry->setBounds (complex.removeFromLeft (complex.getWidth() / 2).reduced (2));
    westUncertainty->setBounds (complex.reduced (2));

    auto function = moduleBounds[1].reduced (10).withTrimmedTop (62);
    auto functionKnobs = function.removeFromTop (function.getHeight() - 70);
    westRise->setBounds (functionKnobs.removeFromLeft (functionKnobs.getWidth() / 2).reduced (2));
    westFall->setBounds (functionKnobs.reduced (2));
    westLoop->setBounds (function.reduced (4));

    auto dynamics = moduleBounds[2].reduced (10).withTrimmedTop (62);
    westColor->setBounds (dynamics.removeFromLeft (dynamics.getWidth() / 2).reduced (2));
    westRing->setBounds (dynamics.reduced (2));
}

void CoastsAudioProcessorEditor::drawModule (juce::Graphics& g,
                                              juce::Rectangle<int> bounds,
                                              const juce::String& index,
                                              const juce::String& title,
                                              const juce::String& subtitle,
                                              const juce::String& code) const
{
    g.setColour (ink);
    g.drawRect (bounds, 1);
    g.fillRect (bounds.getX(), bounds.getY(), bounds.getWidth(), 2);
    g.drawHorizontalLine (bounds.getY() + 54,
                          static_cast<float> (bounds.getX()),
                          static_cast<float> (bounds.getRight()));

    auto indexBounds = juce::Rectangle<int> (bounds.getX() + 10, bounds.getY() + 13, 26, 26);
    g.setColour (signal);
    g.fillRect (indexBounds);
    g.setColour (ink);
    g.drawRect (indexBounds, 1);
    g.setFont (dataFont (9.0f));
    g.drawText (index, indexBounds, juce::Justification::centred);

    g.setFont (displayFont (16.0f));
    g.drawFittedText (title, { bounds.getX() + 46, bounds.getY() + 9, bounds.getWidth() - 94, 22 },
                      juce::Justification::centredLeft, 1);
    g.setColour (muted);
    g.setFont (dataFont (8.0f));
    g.drawFittedText (subtitle, { bounds.getX() + 46, bounds.getY() + 29, bounds.getWidth() - 94, 14 },
                      juce::Justification::centredLeft, 1);
    g.setColour (ink);
    g.setFont (dataFont (9.0f));
    g.drawText (code, { bounds.getRight() - 44, bounds.getY() + 13, 34, 26 },
                juce::Justification::centredRight);
}

juce::AudioProcessorEditor* CoastsAudioProcessor::createEditor()
{
    return new CoastsAudioProcessorEditor (*this);
}
