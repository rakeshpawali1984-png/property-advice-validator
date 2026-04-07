#!/bin/bash
cd "$(dirname "$0")"
echo "Starting Buyer Agent Scorecard on http://localhost:3002"
npx next dev --port 3002
