#pragma once

#include <functional>
#include <string>
#include <vector>

namespace voxterm
{
struct SpeechRender
{
    std::vector<float> samples;
    double sampleRate = 0.0;
};

using SpeechCallback = std::function<void (SpeechRender&&)>;

void renderSpeechAsync (const std::string& text,
                        float normalisedRate,
                        float pitchMultiplier,
                        int voiceIndex,
                        SpeechCallback callback);
}
