# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# Add any project specific keep options here:

# react-native-worklets. Copied from
# node_modules/react-native-worklets/android/proguard-rules.pro so that these
# keeps do not depend on that package continuing to declare consumer rules.
-keep class com.swmansion.worklets.** { *; }
-keep class com.facebook.react.fabric.** { *; }
