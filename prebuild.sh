#!/bin/bash
set -e

# Export compiler flags
export CFLAGS="-I/usr/include/portaudio19-dev"
export LDFLAGS="-L/usr/lib/x86_64-linux-gnu"


# Install system dependencies
apt-get install -y \
    portaudio19-dev \
    python3-pyaudio \
    libasound2-dev \
    libportaudio2 \
    libportaudiocpp0 \
    ffmpeg \
    build-essential \
    python3-dev

# Upgrade pip
python -m pip install --upgrade pip