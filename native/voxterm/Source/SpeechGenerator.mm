#include "SpeechGenerator.h"

#import <AVFoundation/AVFoundation.h>
#import <Foundation/Foundation.h>

#include <algorithm>
#include <atomic>
#include <memory>

namespace voxterm
{
void renderSpeechAsync (const std::string& text,
                        float normalisedRate,
                        float pitchMultiplier,
                        int voiceIndex,
                        SpeechCallback callback)
{
    if (text.empty())
    {
        callback ({ });
        return;
    }

    auto callbackHolder = std::make_shared<SpeechCallback> (std::move (callback));
    auto samples = std::make_shared<std::vector<float>>();
    auto sampleRate = std::make_shared<double> (0.0);
    auto completed = std::make_shared<std::atomic<bool>> (false);

    dispatch_async (dispatch_get_main_queue(), ^{
        @autoreleasepool
        {
            NSString* phrase = [NSString stringWithUTF8String:text.c_str()];
            AVSpeechUtterance* utterance = [AVSpeechUtterance speechUtteranceWithString:phrase];

            const auto clampedRate = std::clamp (normalisedRate, 0.0f, 1.0f);
            utterance.rate = AVSpeechUtteranceMinimumSpeechRate
                + clampedRate * (AVSpeechUtteranceMaximumSpeechRate
                                 - AVSpeechUtteranceMinimumSpeechRate);
            utterance.pitchMultiplier = std::clamp (pitchMultiplier, 0.5f, 2.0f);
            utterance.volume = 1.0f;

            NSArray<AVSpeechSynthesisVoice*>* available = [AVSpeechSynthesisVoice speechVoices];
            NSMutableArray<AVSpeechSynthesisVoice*>* english = [NSMutableArray array];

            for (AVSpeechSynthesisVoice* voice in available)
                if ([voice.language hasPrefix:@"en"])
                    [english addObject:voice];

            if (english.count > 0)
            {
                const auto selected = static_cast<NSUInteger> (
                    std::abs (voiceIndex) % static_cast<int> (english.count));
                utterance.voice = english[selected];
            }

            __block AVSpeechSynthesizer* synthesizer = [[AVSpeechSynthesizer alloc] init];

            [synthesizer writeUtterance:utterance
                       toBufferCallback:^(AVAudioBuffer* audioBuffer)
            {
                AVAudioPCMBuffer* pcm = [audioBuffer isKindOfClass:[AVAudioPCMBuffer class]]
                    ? static_cast<AVAudioPCMBuffer*> (audioBuffer)
                    : nil;

                if (pcm == nil || pcm.frameLength == 0)
                {
                    if (! completed->exchange (true))
                    {
                        auto render = std::make_shared<SpeechRender>();
                        render->samples = std::move (*samples);
                        render->sampleRate = *sampleRate;

                        dispatch_async (dispatch_get_global_queue (QOS_CLASS_USER_INITIATED, 0), ^{
                            (*callbackHolder) (std::move (*render));
                        });
                    }

                    synthesizer = nil;
                    return;
                }

                if (*sampleRate <= 0.0)
                    *sampleRate = pcm.format.sampleRate;

                const auto frames = static_cast<size_t> (pcm.frameLength);
                const auto channels = static_cast<size_t> (pcm.format.channelCount);
                float* const* channelData = pcm.floatChannelData;

                if (channelData == nullptr || channels == 0)
                    return;

                const auto originalSize = samples->size();
                samples->resize (originalSize + frames);

                for (size_t frame = 0; frame < frames; ++frame)
                {
                    auto sum = 0.0f;
                    for (size_t channel = 0; channel < channels; ++channel)
                        sum += channelData[channel][frame];

                    (*samples)[originalSize + frame] = sum / static_cast<float> (channels);
                }
            }];
        }
    });
}
}
