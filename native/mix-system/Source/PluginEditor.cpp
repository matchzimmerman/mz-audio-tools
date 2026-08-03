#include "PluginEditor.h"

namespace
{
const auto ink = juce::Colour::fromRGB (5, 8, 7);
const auto panel = juce::Colour::fromRGB (13, 19, 16);
const auto acid = juce::Colour::fromRGB (211, 255, 69);
const auto bone = juce::Colour::fromRGB (255, 244, 220);
const auto muted = juce::Colour::fromRGB (103, 126, 91);
const auto orange = juce::Colour::fromRGB (255, 142, 48);

juce::String dbText (float linear)
{
    return juce::String (juce::Decibels::gainToDecibels (linear, -72.0f), 1) + " dB";
}

float strongestReduction (const mz::SpectralValues& reductions)
{
    auto result = 0.0f;
    for (const auto value : reductions)
        result = juce::jmin (result, value);
    return result;
}
}

MZMixSystemAudioProcessorEditor::MZMixSystemAudioProcessorEditor (MZMixSystemAudioProcessor& p)
    : AudioProcessorEditor (&p), processor (p)
{
    setSize (1060, 760);
    setResizable (true, true);
    setResizeLimits (860, 650, 1500, 1050);

    look.setColour (juce::ComboBox::backgroundColourId, ink);
    look.setColour (juce::ComboBox::textColourId, acid);
    look.setColour (juce::ComboBox::outlineColourId, muted);
    look.setColour (juce::PopupMenu::backgroundColourId, panel);
    look.setColour (juce::PopupMenu::textColourId, acid);
    look.setColour (juce::Slider::rotarySliderFillColourId, acid);
    look.setColour (juce::Slider::rotarySliderOutlineColourId, muted.withAlpha (0.55f));
    look.setColour (juce::Slider::thumbColourId, acid);
    look.setColour (juce::Slider::textBoxTextColourId, bone);
    look.setColour (juce::Slider::textBoxBackgroundColourId, ink);
    look.setColour (juce::Slider::textBoxOutlineColourId, muted);
    setLookAndFeel (&look);

    configureCombo (modeBox, { "NODE", "CONDUCTOR" });
    configureCombo (roleBox, { "FOUNDATION", "RHYTHM", "BODY", "FOCUS", "AIR" });
    configureCombo (autoBox, { "OFF", "GENTLE", "FIRM" });
    configureCombo (widthBox, { "AUTO", "NARROW", "BALANCED", "WIDE" });
    configureCombo (monoBox, { "AUTO", "OFF", "60 HZ", "90 HZ", "120 HZ", "150 HZ", "200 HZ" });
    configureCombo (densityBox, { "SPARSE", "NORMAL", "FULL" });

    configureSlider (importanceSlider, "", 0);
    importanceSlider.setRange (1.0, 5.0, 1.0);
    configureSlider (outputTrimSlider, " dB", 1);
    configureSlider (spectralDepthSlider, " %", 0);
    configureSlider (globalAutoSlider, " %", 0);

    for (auto* component : std::array<juce::Component*, 10>
         { &modeBox, &roleBox, &autoBox, &widthBox, &monoBox, &densityBox,
           &importanceSlider, &outputTrimSlider, &spectralDepthSlider, &globalAutoSlider })
        addAndMakeVisible (*component);

    modeAttachment = std::make_unique<ComboAttachment> (processor.parameters, "mode", modeBox);
    roleAttachment = std::make_unique<ComboAttachment> (processor.parameters, "role", roleBox);
    autoAttachment = std::make_unique<ComboAttachment> (processor.parameters, "autoMode", autoBox);
    widthAttachment = std::make_unique<ComboAttachment> (processor.parameters, "widthPolicy", widthBox);
    monoAttachment = std::make_unique<ComboAttachment> (processor.parameters, "monoPolicy", monoBox);
    densityAttachment = std::make_unique<ComboAttachment> (processor.parameters, "density", densityBox);
    importanceAttachment = std::make_unique<SliderAttachment> (processor.parameters, "importance", importanceSlider);
    outputTrimAttachment = std::make_unique<SliderAttachment> (processor.parameters, "outputTrim", outputTrimSlider);
    spectralDepthAttachment = std::make_unique<SliderAttachment> (
        processor.parameters, "spectralDepth", spectralDepthSlider);
    globalAutoAttachment = std::make_unique<SliderAttachment> (
        processor.parameters, "globalAuto", globalAutoSlider);

    previousConductorState = ! processor.isConductorMode();
    updateModeVisibility();
    startTimerHz (20);
}

MZMixSystemAudioProcessorEditor::~MZMixSystemAudioProcessorEditor()
{
    setLookAndFeel (nullptr);
}

void MZMixSystemAudioProcessorEditor::configureCombo (juce::ComboBox& box,
                                                       const juce::StringArray& items)
{
    box.addItemList (items, 1);
    box.setJustificationType (juce::Justification::centred);
}

void MZMixSystemAudioProcessorEditor::configureSlider (juce::Slider& slider,
                                                        const juce::String& suffix,
                                                        int decimals)
{
    slider.setSliderStyle (juce::Slider::RotaryHorizontalVerticalDrag);
    slider.setTextBoxStyle (juce::Slider::TextBoxBelow, false, 82, 24);
    slider.setTextValueSuffix (suffix);
    slider.setNumDecimalPlacesToDisplay (decimals);
}

void MZMixSystemAudioProcessorEditor::timerCallback()
{
    updateModeVisibility();
    repaint();
}

void MZMixSystemAudioProcessorEditor::updateModeVisibility()
{
    const auto conductor = processor.isConductorMode();
    if (conductor == previousConductorState)
        return;

    previousConductorState = conductor;
    roleBox.setVisible (! conductor);
    autoBox.setVisible (! conductor);
    widthBox.setVisible (! conductor);
    monoBox.setVisible (! conductor);
    densityBox.setVisible (! conductor);
    importanceSlider.setVisible (! conductor);
    outputTrimSlider.setVisible (! conductor);
    spectralDepthSlider.setVisible (! conductor);
    globalAutoSlider.setVisible (conductor);
    resized();
}

void MZMixSystemAudioProcessorEditor::paint (juce::Graphics& g)
{
    g.fillAll (ink);
    drawHeader (g);

    if (processor.isConductorMode())
        drawConductorPanel (g);
    else
        drawNodePanel (g);
}

void MZMixSystemAudioProcessorEditor::drawHeader (juce::Graphics& g)
{
    auto bounds = getLocalBounds().reduced (26);
    auto header = bounds.removeFromTop (78);

    g.setColour (acid);
    g.setFont (juce::Font (juce::FontOptions (29.0f).withStyle ("Bold")));
    g.drawText ("MZ MIX SYSTEM", header.removeFromTop (38), juce::Justification::centredLeft);

    g.setFont (juce::Font (juce::FontOptions (12.0f).withStyle ("Bold")));
    g.drawText ("ROLE-AWARE INTER-INSTANCE MIX ECOLOGY / FIELD SPECIMEN 0.2",
                header.removeFromTop (22), juce::Justification::centredLeft);

    g.setColour (muted);
    g.drawHorizontalLine (94, 26.0f, static_cast<float> (getWidth() - 26));

    g.setColour (bone);
    g.setFont (juce::Font (juce::FontOptions (11.0f).withStyle ("Bold")));
    g.drawText ("VIEW", modeBox.getBounds().translated (0, -22), juce::Justification::centredLeft);
}

void MZMixSystemAudioProcessorEditor::drawLevelMeter (juce::Graphics& g,
                                                       juce::Rectangle<float> area,
                                                       float rms)
{
    g.setColour (panel);
    g.fillRect (area);
    g.setColour (muted);
    g.drawRect (area, 1.0f);

    const auto db = juce::Decibels::gainToDecibels (rms, -72.0f);
    const auto amount = juce::jlimit (0.0f, 1.0f, (db + 60.0f) / 60.0f);
    auto fill = area.reduced (3.0f);
    fill.setWidth (fill.getWidth() * amount);
    g.setColour (amount > 0.9f ? orange : acid);
    g.fillRect (fill);
}

void MZMixSystemAudioProcessorEditor::drawSpectralMeter (
    juce::Graphics& g,
    juce::Rectangle<float> area,
    const mz::SpectralValues& spectrum,
    const mz::SpectralValues& reductions)
{
    const auto cellWidth = area.getWidth() / static_cast<float> (mz::spectralBandCount);

    for (int band = 0; band < mz::spectralBandCount; ++band)
    {
        auto cell = area.withX (area.getX() + cellWidth * static_cast<float> (band))
                        .withWidth (cellWidth)
                        .reduced (5.0f, 0.0f);
        auto labelArea = cell.removeFromBottom (22.0f);
        auto reductionArea = cell.removeFromBottom (17.0f);
        auto meter = cell.reduced (2.0f, 1.0f);

        g.setColour (panel.brighter (0.08f));
        g.fillRect (meter);
        g.setColour (muted);
        g.drawRect (meter, 1.0f);

        const auto db = juce::Decibels::gainToDecibels (
            spectrum[static_cast<size_t> (band)], -72.0f);
        const auto amount = juce::jlimit (0.0f, 1.0f, (db + 66.0f) / 66.0f);
        auto fill = meter.reduced (3.0f);
        fill.removeFromTop (fill.getHeight() * (1.0f - amount));

        g.setColour (acid.withAlpha (0.85f));
        g.fillRect (fill);

        const auto reduction = reductions[static_cast<size_t> (band)];
        g.setColour (reduction < -0.05f ? orange : muted);
        g.setFont (juce::Font (juce::FontOptions (10.0f).withStyle ("Bold")));
        g.drawText (juce::String (reduction, 1) + " dB",
                    reductionArea.toNearestInt(),
                    juce::Justification::centred);

        g.setColour (bone);
        g.drawText (mz::spectralBandName (band),
                    labelArea.toNearestInt(),
                    juce::Justification::centred);
    }
}

void MZMixSystemAudioProcessorEditor::drawNodePanel (juce::Graphics& g)
{
    const auto role = processor.currentRole();
    const auto& profile = mz::getRoleProfile (role);

    g.setColour (panel);
    g.fillRoundedRectangle (juce::Rectangle<float> (24.0f, 116.0f,
                                                     static_cast<float> (getWidth() - 48),
                                                     static_cast<float> (getHeight() - 142)), 10.0f);

    g.setColour (profile.accent);
    g.setFont (juce::Font (juce::FontOptions (22.0f).withStyle ("Bold")));
    g.drawText ("NODE " + juce::String (processor.getRegistrySlot() + 1).paddedLeft ('0', 2)
                    + " / " + mz::roleName (role),
                48, 132, getWidth() - 96, 32, juce::Justification::centredLeft);

    const auto labelFont = juce::Font (juce::FontOptions (11.0f).withStyle ("Bold"));
    g.setFont (labelFont);
    g.setColour (muted);

    const std::array<std::pair<juce::Component*, const char*>, 8> labels
    {{
        { &roleBox, "ROLE" },
        { &importanceSlider, "IMPORTANCE" },
        { &autoBox, "AUTO MIX" },
        { &densityBox, "DENSITY" },
        { &widthBox, "WIDTH POLICY" },
        { &monoBox, "MONO PROTECT" },
        { &outputTrimSlider, "OUTPUT TRIM" },
        { &spectralDepthSlider, "SPECTRAL NEGOTIATION" }
    }};

    for (const auto& item : labels)
        g.drawText (item.second, item.first->getBounds().translated (0, -20),
                    juce::Justification::centred);

    const auto telemetryY = getHeight() - 180;
    g.setColour (ink);
    g.fillRoundedRectangle (38.0f, static_cast<float> (telemetryY),
                            static_cast<float> (getWidth() - 76), 138.0f, 6.0f);

    g.setColour (bone);
    g.setFont (juce::Font (juce::FontOptions (12.0f).withStyle ("Bold")));
    g.drawText ("INPUT " + dbText (processor.getInputRms()),
                58, telemetryY + 12, 180, 22, juce::Justification::centredLeft);
    g.drawText ("LEVEL YIELD " + juce::String (processor.getCurrentDuckDb(), 2) + " dB",
                250, telemetryY + 12, 210, 22, juce::Justification::centredLeft);
    g.drawText ("WIDTH " + juce::String (processor.getEffectiveWidth() * 100.0f, 0) + "%",
                472, telemetryY + 12, 150, 22, juce::Justification::centredLeft);
    g.drawText ("MONO < " + juce::String (processor.getEffectiveMonoHz(), 0) + " Hz",
                632, telemetryY + 12, 180, 22, juce::Justification::centredLeft);

    drawSpectralMeter (g,
                       { 52.0f, static_cast<float> (telemetryY + 40),
                         static_cast<float> (getWidth() - 104), 88.0f },
                       processor.getInputSpectrum(),
                       processor.getSpectralReductionDb());
}

void MZMixSystemAudioProcessorEditor::drawConductorPanel (juce::Graphics& g)
{
    g.setColour (panel);
    g.fillRoundedRectangle (juce::Rectangle<float> (24.0f, 116.0f,
                                                     static_cast<float> (getWidth() - 48),
                                                     static_cast<float> (getHeight() - 142)), 10.0f);

    g.setColour (acid);
    g.setFont (juce::Font (juce::FontOptions (22.0f).withStyle ("Bold")));
    g.drawText ("CONDUCTOR / SHARED SPECTRAL PRIORITY FIELD", 48, 132,
                getWidth() - 96, 32, juce::Justification::centredLeft);

    g.setColour (muted);
    g.setFont (juce::Font (juce::FontOptions (11.0f).withStyle ("Bold")));
    g.drawText ("GLOBAL AUTO STRENGTH", globalAutoSlider.getBounds().translated (0, -20),
                juce::Justification::centred);

    const auto snapshots = processor.getNodeSnapshots();
    const auto rowLeft = 48;
    const auto rowWidth = getWidth() - 96;
    int rowY = 272;

    g.setColour (muted);
    g.drawText ("NODE", rowLeft, rowY - 28, 70, 22, juce::Justification::centredLeft);
    g.drawText ("ROLE", rowLeft + 78, rowY - 28, 150, 22, juce::Justification::centredLeft);
    g.drawText ("PRIORITY", rowLeft + 240, rowY - 28, 80, 22, juce::Justification::centredLeft);
    g.drawText ("LEVEL", rowLeft + 334, rowY - 28, 110, 22, juce::Justification::centredLeft);
    g.drawText ("WIDTH", rowLeft + 456, rowY - 28, 100, 22, juce::Justification::centredLeft);
    g.drawText ("MONO", rowLeft + 568, rowY - 28, 110, 22, juce::Justification::centredLeft);
    g.drawText ("MAX CARVE", rowLeft + 690, rowY - 28, 110, 22, juce::Justification::centredLeft);

    if (snapshots.empty())
    {
        g.setColour (bone.withAlpha (0.65f));
        g.setFont (juce::Font (juce::FontOptions (16.0f)));
        g.drawText ("NO ACTIVE NODES / INSERT THIS PLUG-IN ON TRACKS AND SELECT NODE",
                    48, rowY + 30, rowWidth, 34, juce::Justification::centred);
        return;
    }

    const auto maximumRows = juce::jmax (1, (getHeight() - rowY - 48) / 46);
    for (int index = 0; index < juce::jmin (maximumRows, static_cast<int> (snapshots.size())); ++index)
    {
        const auto& node = snapshots[static_cast<size_t> (index)];
        const auto& profile = mz::getRoleProfile (node.role);

        g.setColour (index % 2 == 0 ? ink : ink.brighter (0.06f));
        g.fillRoundedRectangle (static_cast<float> (rowLeft), static_cast<float> (rowY),
                                static_cast<float> (rowWidth), 38.0f, 4.0f);
        g.setColour (profile.accent);
        g.fillRect (rowLeft, rowY, 5, 38);

        g.setColour (bone);
        g.setFont (juce::Font (juce::FontOptions (13.0f).withStyle ("Bold")));
        g.drawText (juce::String (node.slot + 1).paddedLeft ('0', 2), rowLeft + 16, rowY, 55, 38,
                    juce::Justification::centredLeft);
        g.drawText (mz::roleName (node.role), rowLeft + 78, rowY, 150, 38,
                    juce::Justification::centredLeft);
        g.drawText (juce::String (node.importance), rowLeft + 240, rowY, 80, 38,
                    juce::Justification::centredLeft);
        g.drawText (dbText (node.rmsLinear), rowLeft + 334, rowY, 110, 38,
                    juce::Justification::centredLeft);
        g.drawText (juce::String (node.width * 100.0f, 0) + "%", rowLeft + 456, rowY, 100, 38,
                    juce::Justification::centredLeft);
        g.drawText (juce::String (node.monoHz, 0) + " Hz", rowLeft + 568, rowY, 110, 38,
                    juce::Justification::centredLeft);
        g.drawText (juce::String (strongestReduction (node.spectralDuckDb), 2) + " dB",
                    rowLeft + 690, rowY, 110, 38,
                    juce::Justification::centredLeft);

        rowY += 46;
    }
}

void MZMixSystemAudioProcessorEditor::resized()
{
    modeBox.setBounds (getWidth() - 214, 42, 180, 32);

    if (processor.isConductorMode())
    {
        globalAutoSlider.setBounds (48, 176, 130, 96);
        return;
    }

    auto area = getLocalBounds().reduced (48);
    area.removeFromTop (152);
    area.removeFromBottom (176);

    const auto columnWidth = area.getWidth() / 4;
    const auto topHeight = area.getHeight() / 2;

    roleBox.setBounds (area.getX(), area.getY() + 24, columnWidth - 18, 36);
    importanceSlider.setBounds (area.getX() + columnWidth, area.getY(), columnWidth - 18, topHeight - 4);
    autoBox.setBounds (area.getX() + columnWidth * 2, area.getY() + 24, columnWidth - 18, 36);
    densityBox.setBounds (area.getX() + columnWidth * 3, area.getY() + 24, columnWidth - 18, 36);

    const auto lowerY = area.getY() + topHeight;
    widthBox.setBounds (area.getX(), lowerY + 24, columnWidth - 18, 36);
    monoBox.setBounds (area.getX() + columnWidth, lowerY + 24, columnWidth - 18, 36);
    outputTrimSlider.setBounds (area.getX() + columnWidth * 2, lowerY, columnWidth - 18, topHeight - 4);
    spectralDepthSlider.setBounds (area.getX() + columnWidth * 3, lowerY,
                                   columnWidth - 18, topHeight - 4);
}
