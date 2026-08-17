cmake_minimum_required(VERSION 3.22)

project(MZEmergentField VERSION 0.1.0 LANGUAGES C CXX)

include(FetchContent)

FetchContent_Declare(
  JUCE
  GIT_REPOSITORY https://github.com/juce-framework/JUCE.git
  GIT_TAG 8.0.15
  GIT_SHALLOW TRUE
)
FetchContent_MakeAvailable(JUCE)

set(MZ_EMERGENT_FORMATS VST3 Standalone)
if(APPLE)
  list(APPEND MZ_EMERGENT_FORMATS AU)
endif()

juce_add_plugin(MZEmergentField
  COMPANY_NAME "Match Zimmerman Creative Media Group"
  BUNDLE_ID "com.mzcmg.emergentfield"
  IS_SYNTH TRUE
  NEEDS_MIDI_INPUT TRUE
  NEEDS_MIDI_OUTPUT FALSE
  IS_MIDI_EFFECT FALSE
  EDITOR_WANTS_KEYBOARD_FOCUS FALSE
  COPY_PLUGIN_AFTER_BUILD FALSE
  PLUGIN_MANUFACTURER_CODE Mzcm
  PLUGIN_CODE EmFd
  FORMATS ${MZ_EMERGENT_FORMATS}
  PRODUCT_NAME "MZ EMERGENT FIELD"
)

juce_generate_juce_header(MZEmergentField)

target_sources(MZEmergentField
  PRIVATE
    Source/GenerativeEngine.cpp
    Source/GenerativeEngine.h
    Source/PluginEditor.cpp
    Source/PluginEditor.h
    Source/PluginProcessor.cpp
    Source/PluginProcessor.h
)

target_compile_features(MZEmergentField PRIVATE cxx_std_17)

target_compile_definitions(MZEmergentField
  PUBLIC
    JUCE_WEB_BROWSER=0
    JUCE_USE_CURL=0
    JUCE_VST3_CAN_REPLACE_VST2=0
)

target_link_libraries(MZEmergentField
  PRIVATE
    juce::juce_audio_utils
    juce::juce_dsp
  PUBLIC
    juce::juce_recommended_config_flags
    juce::juce_recommended_lto_flags
    juce::juce_recommended_warning_flags
)
