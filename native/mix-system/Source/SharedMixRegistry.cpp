#include "SharedMixRegistry.h"

namespace mz
{
SharedMixRegistry& SharedMixRegistry::instance() noexcept
{
    static SharedMixRegistry registry;
    return registry;
}

int SharedMixRegistry::registerInstance() noexcept
{
    for (int index = 0; index < maxNodes; ++index)
    {
        bool expected = false;
        if (slots[static_cast<size_t> (index)].occupied.compare_exchange_strong (expected, true))
        {
            auto& slot = slots[static_cast<size_t> (index)];
            slot.active.store (false);
            slot.rmsLinear.store (0.0f);
            slot.duckDb.store (0.0f);
            for (auto& value : slot.spectrum)
                value.store (0.0f, std::memory_order_relaxed);
            for (auto& value : slot.spectralDuckDb)
                value.store (0.0f, std::memory_order_relaxed);
            return index;
        }
    }

    return -1;
}

void SharedMixRegistry::unregisterInstance (int slotIndex) noexcept
{
    if (! juce::isPositiveAndBelow (slotIndex, maxNodes))
        return;

    auto& slot = slots[static_cast<size_t> (slotIndex)];
    slot.active.store (false, std::memory_order_release);
    slot.rmsLinear.store (0.0f, std::memory_order_relaxed);
    for (auto& value : slot.spectrum)
        value.store (0.0f, std::memory_order_relaxed);
    for (auto& value : slot.spectralDuckDb)
        value.store (0.0f, std::memory_order_relaxed);
    slot.occupied.store (false, std::memory_order_release);
}

void SharedMixRegistry::publishNode (int slotIndex,
                                     bool isActive,
                                     MixRole nodeRole,
                                     int nodeImportance,
                                     float nodeRms,
                                     float nodeDuckDb,
                                     float nodeWidth,
                                     float nodeMonoHz,
                                     const SpectralValues& nodeSpectrum,
                                     const SpectralValues& nodeSpectralDuckDb) noexcept
{
    if (! juce::isPositiveAndBelow (slotIndex, maxNodes))
        return;

    auto& slot = slots[static_cast<size_t> (slotIndex)];
    slot.role.store (static_cast<int> (nodeRole), std::memory_order_relaxed);
    slot.importance.store (juce::jlimit (1, 5, nodeImportance), std::memory_order_relaxed);
    slot.rmsLinear.store (juce::jlimit (0.0f, 4.0f, nodeRms), std::memory_order_relaxed);
    slot.duckDb.store (juce::jlimit (-12.0f, 0.0f, nodeDuckDb), std::memory_order_relaxed);
    slot.width.store (juce::jlimit (0.0f, 2.0f, nodeWidth), std::memory_order_relaxed);
    slot.monoHz.store (juce::jlimit (0.0f, 500.0f, nodeMonoHz), std::memory_order_relaxed);

    for (int band = 0; band < spectralBandCount; ++band)
    {
        slot.spectrum[static_cast<size_t> (band)].store (
            juce::jlimit (0.0f, 4.0f, nodeSpectrum[static_cast<size_t> (band)]),
            std::memory_order_relaxed);
        slot.spectralDuckDb[static_cast<size_t> (band)].store (
            juce::jlimit (-12.0f, 0.0f, nodeSpectralDuckDb[static_cast<size_t> (band)]),
            std::memory_order_relaxed);
    }

    slot.active.store (isActive, std::memory_order_release);
}

float SharedMixRegistry::activityFromRms (float rmsLinear) noexcept
{
    if (rmsLinear <= 0.00001f)
        return 0.0f;

    const auto db = juce::Decibels::gainToDecibels (rmsLinear, -100.0f);
    return juce::jlimit (0.0f, 1.0f, (db + 58.0f) / 38.0f);
}

float SharedMixRegistry::activityFromBandRms (float rmsLinear, int band) noexcept
{
    if (rmsLinear <= 0.000001f)
        return 0.0f;

    static constexpr std::array<float, spectralBandCount> floors
    {{ -62.0f, -62.0f, -64.0f, -68.0f, -72.0f }};
    static constexpr std::array<float, spectralBandCount> ceilings
    {{ -18.0f, -19.0f, -21.0f, -24.0f, -28.0f }};

    const auto index = static_cast<size_t> (juce::jlimit (0, spectralBandCount - 1, band));
    const auto db = juce::Decibels::gainToDecibels (rmsLinear, -100.0f);
    return juce::jlimit (0.0f, 1.0f,
                         (db - floors[index]) / (ceilings[index] - floors[index]));
}

float SharedMixRegistry::relationshipWeight (MixRole ownRole,
                                             int ownImportance,
                                             MixRole otherRole,
                                             int otherImportance) noexcept
{
    if (ownRole == otherRole && otherImportance <= ownImportance)
        return 0.0f;

    float weight = 0.0f;

    if (otherRole == MixRole::focus)
    {
        if (ownRole == MixRole::body)
            weight = 1.0f;
        else if (ownRole == MixRole::air)
            weight = 0.82f;
        else if (ownRole == MixRole::rhythm)
            weight = 0.35f;
        else if (ownRole == MixRole::foundation)
            weight = 0.20f;
    }

    if (ownRole == MixRole::foundation && otherRole == MixRole::rhythm)
        weight = juce::jmax (weight, otherImportance >= ownImportance ? 0.80f : 0.32f);

    if (ownRole == MixRole::rhythm && otherRole == MixRole::foundation)
        weight = juce::jmax (weight, otherImportance > ownImportance ? 0.52f : 0.12f);

    if (otherImportance > ownImportance)
    {
        const auto difference = static_cast<float> (otherImportance - ownImportance);
        weight = juce::jmax (weight, juce::jlimit (0.0f, 0.75f, 0.18f * difference));
    }

    if (ownRole == MixRole::focus && otherRole != MixRole::focus)
        weight *= 0.25f;

    return juce::jlimit (0.0f, 1.0f, weight);
}

SpectralValues SharedMixRegistry::roleBandSensitivity (MixRole role) noexcept
{
    static constexpr std::array<SpectralValues, 5> values
    {{
        {{ 1.00f, 0.90f, 0.48f, 0.18f, 0.08f }},
        {{ 0.82f, 0.95f, 0.82f, 0.52f, 0.28f }},
        {{ 0.28f, 0.72f, 1.00f, 0.95f, 0.58f }},
        {{ 0.10f, 0.22f, 0.35f, 0.42f, 0.30f }},
        {{ 0.05f, 0.18f, 0.42f, 0.82f, 1.00f }}
    }};

    return values[static_cast<size_t> (roleFromIndex (static_cast<int> (role)))];
}

float SharedMixRegistry::calculateYield (int ownSlot,
                                         MixRole ownRole,
                                         int ownImportance) const noexcept
{
    float strongestRequest = 0.0f;

    for (int index = 0; index < maxNodes; ++index)
    {
        if (index == ownSlot)
            continue;

        const auto& slot = slots[static_cast<size_t> (index)];
        if (! slot.occupied.load (std::memory_order_acquire)
            || ! slot.active.load (std::memory_order_acquire))
            continue;

        const auto otherRole = roleFromIndex (slot.role.load (std::memory_order_relaxed));
        const auto otherImportance = slot.importance.load (std::memory_order_relaxed);
        const auto relationship = relationshipWeight (ownRole,
                                                       ownImportance,
                                                       otherRole,
                                                       otherImportance);
        const auto activity = activityFromRms (slot.rmsLinear.load (std::memory_order_relaxed));
        strongestRequest = juce::jmax (strongestRequest, relationship * activity);
    }

    return juce::jlimit (0.0f, 1.0f, strongestRequest);
}

SpectralValues SharedMixRegistry::calculateSpectralYield (int ownSlot,
                                                          MixRole ownRole,
                                                          int ownImportance) const noexcept
{
    SpectralValues strongestRequest {};
    const auto sensitivity = roleBandSensitivity (ownRole);

    for (int index = 0; index < maxNodes; ++index)
    {
        if (index == ownSlot)
            continue;

        const auto& slot = slots[static_cast<size_t> (index)];
        if (! slot.occupied.load (std::memory_order_acquire)
            || ! slot.active.load (std::memory_order_acquire))
            continue;

        const auto otherRole = roleFromIndex (slot.role.load (std::memory_order_relaxed));
        const auto otherImportance = slot.importance.load (std::memory_order_relaxed);
        const auto relationship = relationshipWeight (ownRole,
                                                       ownImportance,
                                                       otherRole,
                                                       otherImportance);
        if (relationship <= 0.0f)
            continue;

        for (int band = 0; band < spectralBandCount; ++band)
        {
            const auto activity = activityFromBandRms (
                slot.spectrum[static_cast<size_t> (band)].load (std::memory_order_relaxed),
                band);
            const auto request = relationship * sensitivity[static_cast<size_t> (band)] * activity;
            strongestRequest[static_cast<size_t> (band)] = juce::jmax (
                strongestRequest[static_cast<size_t> (band)],
                juce::jlimit (0.0f, 1.0f, request));
        }
    }

    return strongestRequest;
}

void SharedMixRegistry::setGlobalStrength (float amount) noexcept
{
    globalStrength.store (juce::jlimit (0.0f, 1.0f, amount), std::memory_order_relaxed);
}

float SharedMixRegistry::getGlobalStrength() const noexcept
{
    return globalStrength.load (std::memory_order_relaxed);
}

std::vector<SharedMixRegistry::Snapshot> SharedMixRegistry::snapshots() const
{
    std::vector<Snapshot> result;
    result.reserve (maxNodes);

    for (int index = 0; index < maxNodes; ++index)
    {
        const auto& slot = slots[static_cast<size_t> (index)];
        if (! slot.occupied.load (std::memory_order_acquire)
            || ! slot.active.load (std::memory_order_acquire))
            continue;

        Snapshot snapshot;
        snapshot.slot = index;
        snapshot.active = true;
        snapshot.role = roleFromIndex (slot.role.load (std::memory_order_relaxed));
        snapshot.importance = slot.importance.load (std::memory_order_relaxed);
        snapshot.rmsLinear = slot.rmsLinear.load (std::memory_order_relaxed);
        snapshot.duckDb = slot.duckDb.load (std::memory_order_relaxed);
        snapshot.width = slot.width.load (std::memory_order_relaxed);
        snapshot.monoHz = slot.monoHz.load (std::memory_order_relaxed);

        for (int band = 0; band < spectralBandCount; ++band)
        {
            snapshot.spectrum[static_cast<size_t> (band)] =
                slot.spectrum[static_cast<size_t> (band)].load (std::memory_order_relaxed);
            snapshot.spectralDuckDb[static_cast<size_t> (band)] =
                slot.spectralDuckDb[static_cast<size_t> (band)].load (std::memory_order_relaxed);
        }

        result.push_back (snapshot);
    }

    return result;
}
} // namespace mz
