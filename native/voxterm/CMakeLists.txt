cmake_minimum_required(VERSION 3.22)

project(MZVoxTerm VERSION 0.1.0 LANGUAGES C CXX OBJCXX)

include(FetchContent)

FetchContent_Declare(
  JUCE
  GIT_REPOSITORY https://github.com/juce-framework/JUCE.git
  GIT_TAG 8.0.15
  GIT_SHALLOW TRUE
)
FetchContent_MakeAvailable(JUCE)

juce_add_plugin(VoxTerm
  COMPANY_NAME "Match Zimmerman Creative Media Group"
  BUNDLE_ID "com.mzcmg.voxterm"
  IS_SYNTH TRUE
  NEEDS_MIDI_INPUT TRUE
  NEEDS_MIDI_OUTPUT FALSE
  IS_MIDI_EFFECT FALSE
  EDITOR_WANTS_KEYBOARD_FOCUS TRUE
  COPY_PLUGIN_AFTER_BUILD FALSE
  PLUGIN_MANUFACTURER_CODE Mzcm
  PLUGIN_CODE VxTm
  FORMATS AU VST3 Standalone
  PRODUCT_NAME "MZ-05 VOXTERM"
)

juce_generate_juce_header(VoxTerm)

target_sources(VoxTerm
  PRIVATE
    Source/PluginEditor.cpp
    Source/PluginEditor.h
    Source/PluginProcessor.cpp
    Source/PluginProcessor.h
    Source/SpeechGenerator.h
    Source/SpeechGenerator.mm
)

set_source_files_properties(
  Source/SpeechGenerator.mm
  PROPERTIES COMPILE_FLAGS "-fobjc-arc"
)

target_compile_features(VoxTerm PRIVATE cxx_std_17)

target_compile_definitions(VoxTerm
  PUBLIC
    JUCE_WEB_BROWSER=0
    JUCE_USE_CURL=0
    JUCE_VST3_CAN_REPLACE_VST2=0
)

target_link_libraries(VoxTerm
  PRIVATE
    juce::juce_audio_utils
    juce::juce_dsp
    "-framework AVFoundation"
  PUBLIC
    juce::juce_recommended_config_flags
    juce::juce_recommended_lto_flags
    juce::juce_recommended_warning_flags
)
