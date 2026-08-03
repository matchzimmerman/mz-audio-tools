#pragma once

#include <array>

namespace mz
{
inline constexpr int spectralBandCount = 5;
using SpectralValues = std::array<float, spectralBandCount>;

inline constexpr std::array<float, spectralBandCount> spectralBandCentresHz
{{ 60.0f, 180.0f, 700.0f, 2500.0f, 8000.0f }};

inline constexpr std::array<float, spectralBandCount - 1> spectralAnalysisCutoffsHz
{{ 100.0f, 300.0f, 1200.0f, 5000.0f }};

inline const char* spectralBandName (int index) noexcept
{
    switch (index)
    {
        case 0:  return "SUB";
        case 1:  return "LOW";
        case 2:  return "BODY";
        case 3:  return "PRES";
        default: return "AIR";
    }
}
} // namespace mz
