#!/bin/bash

# Avoid Javascript memory heap space
export NODE_OPTIONS=--max-old-space-size=4096

# Need a JDK 11
export JAVA_HOME=/usr/lib/jvm/java-1.11.0-openjdk-amd64
# Need a JDK 1.8
#export JAVA_HOME=/usr/lib/jvm/java-8-openjdk-amd64
export PATH=${JAVA_HOME}/bin:$PATH

# Android SDK
export ANDROID_SDK_ROOT="${HOME}/Android/Sdk"

# Android Studio
export CAPACITOR_ANDROID_STUDIO_PATH=/mnt/data/.local/share/JetBrains/Toolbox/apps/AndroidStudio/ch-0/212.5712.43.2112.8815526

# Mozilla developer account
#export AMO_JWT_ISSUER=""
#export AMO_JWT_SECRET=""

#export WEB_EXT_ID="{...}"

export KEYSTORE_PWD="tuTi9_7,;)@"

export GITHUB_TOKEN=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
