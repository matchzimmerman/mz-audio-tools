#pragma once

#include <JuceHeader.h>

namespace mz
{
enum class MixRole : int
{
    foundation = 0,
    rhythm,
    body,
    focus,
    air
};

struct RoleProfile
{
    const char* name;
    float automaticWidth;
    float automaticMonoHz;
    float lowSideGain;
    float supportYield;
    juce::Colour accent;
};

inline MixRole roleFromIndex (int index) noexcept
{
    return static_cast<MixRole> (juce::jlimit (0, 4, index));
}

inline const RoleProfile& getRoleProfile (MixRole role) noexcept
{
    static const std::array<RoleProfile, 5> profiles
    {{
        { "FOUNDATION", 0.76f, 140.0f, 0.0f, 0.55f, juce::Colour::fromRGB (255, 142, 48) },
        { "RHYTHM",     1.00f, 110.0f, 0.0f, 0.45f, juce::Colour::fromRGB (255, 207, 64) },
        { "BODY",       1.16f,  80.0f, 0.20f, 0.85f, juce::Colour::fromRGB (211, 255, 69) },
        { "FOCUS",      0.94f,  60.0f, 0.25f, 0.20f, juce::Colour::fromRGB (255, 244, 220) },
        { "AIR",        1.36f,  35.0f, 0.45f, 1.00f, juce::Colour::fromRGB (193, 141, 255) }
    }};

    return profiles[static_cast<size_t> (roleFromIndex (static_cast<int> (role)))];
}

inline juce::String roleName (MixRole role)
{
    return getRoleProfile (role).name;
}
} // namespace mz
