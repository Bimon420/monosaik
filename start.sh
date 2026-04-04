#!/bin/bash
# Compute the Replit Expo proxy domain so Metro advertises bundle URLs
# that the mobile simulator can actually reach.
# The mobile simulator connects to [id].expo.janeway.replit.dev:5000
EXPO_DOMAIN=$(echo "${REPLIT_DEV_DOMAIN}" | sed 's/\.janeway\.replit\.dev$/.expo.janeway.replit.dev/')

export EXPO_NO_TELEMETRY=1
export REACT_NATIVE_PACKAGER_HOSTNAME="${EXPO_DOMAIN}"
export EXPO_PACKAGER_PROXY_URL="https://${REPLIT_DEV_DOMAIN}"

exec npx expo start --offline --port 5000
