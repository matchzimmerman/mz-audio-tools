#pragma once

#include "MixRole.h"
#include "SpectralBands.h"

namespace mz
{
class SharedMixRegistry
{
public:
    static constexpr int maxNodes = 32;

    struct Snapshot
    {
        int slot = -1;
        bool active = false;
        MixRole role = MixRole::body;
        int importance = 3;
        float rmsLinear = 0.0f;
        float duckDb = 0.0f;
        float width = 1.0f;
        float monoHz = 0.0f;
        SpectralValues spectrum {};
        SpectralValues spectralDuckDb {};
    };

    static SharedMixRegistry& instance() noexcept;

    int registerInstance() noexcept;
    void unregisterInstance (int slot) noexcept;

    void publishNode (int slot,
                      bool active,
                      MixRole role,
                      int importance,
                      float rmsLinear,
                      float duckDb,
                      float width,
                      float monoHz,
                      const SpectralValues& spectrum,
                      const SpectralValues& spectralDuckDb) noexcept;

    float calculateYield (int ownSlot,
                          MixRole ownRole,
                          int ownImportance) const noexcept;

    SpectralValues calculateSpectralYield (int ownSlot,
                                           MixRole ownRole,
                                           int ownImportance) const noexcept;

    void setGlobalStrength (float amount) noexcept;
    float getGlobalStrength() const noexcept;

    std::vector<Snapshot> snapshots() const;

private:
    struct Slot
    {
        Slot() noexcept
        {
            for (auto& value : spectrum)
                value.store (0.0f, std::memory_order_relaxed);
            for (auto& value : spectralDuckDb)
                value.store (0.0f, std::memory_order_relaxed);
        }

        std::atomic<bool> occupied { false };
        std::atomic<bool> active { false };
        std::atomic<int> role { static_cast<int> (MixRole::body) };
        std::atomic<int> importance { 3 };
        std::atomic<float> rmsLinear { 0.0f };
        std::atomic<float> duckDb { 0.0f };
        std::atomic<float> width { 1.0f };
        std::atomic<float> monoHz { 0.0f };
        std::array<std::atomic<float>, spectralBandCount> spectrum;
        std::array<std::atomic<float>, spectralBandCount> spectralDuckDb;
    };

    static float activityFromRms (float rmsLinear) noexcept;
    static float activityFromBandRms (float rmsLinear, int band) noexcept;
    static float relationshipWeight (MixRole ownRole,
                                     int ownImportance,
                                     MixRole otherRole,
                                     int otherImportance) noexcept;
    static SpectralValues roleBandSensitivity (MixRole role) noexcept;

    std::array<Slot, maxNodes> slots;
    std::atomic<float> globalStrength { 0.65f };
};
} // namespace mz
