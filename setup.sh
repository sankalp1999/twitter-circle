#!/bin/bash

# Set the script to exit immediately if any command fails
set -e

# Navigate to the script directory if necessary
# cd /path/to/your/js/files

# Run each JavaScript file in synchronous order

git pull

echo "Installing npm dependencies in case user missed..."
npm install

echo "Running extract_mentions_and_dump.js"
node extract_mentions_and_dump.js

echo "Running preprocess_direct-messages.js"
node preprocess_direct-messages.js

echo "Running pfp_fetch_and_id_correction.js"
node pfp_fetch_and_id_correction.js

echo "Running dm_final_stats_processing.js in the direct-messaging-stats directory"
node direct-messaging-stats/dm_final_stats_processing.js

echo "All scripts have been executed successfully!"

