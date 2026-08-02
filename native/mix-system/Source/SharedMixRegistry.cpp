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
    slot.occupied.store (false, std::memory_order_release);
}

void SharedMixRegistry::publishNode (int slotIndex,
                                     bool isActive,
                                     MixRole nodeRole,
                                     int nodeImportance,
                                     float nodeRms,
                                     float nodeDuckDb,
                                     float nodeWidth,
                                     float nodeMonoHz) noexcept
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
    slot.active.store (isActive, std::memory_order_release);
}

float SharedMixRegistry::activityFromRms (float rmsLinear) noexcept
{
    if (rmsLinear <= 0.00001f)
        return 0.0f;

    const auto db = juce::Decibels::gainToDecibels (rmsLinear, -100.0f);
    return juce::jlimit (0.0f, 1.0f, (db + 58.0f) / 38.0f);
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
        result.push_back (snapshot);
    }

    return result;
}
} // namespace mz
