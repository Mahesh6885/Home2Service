#!/usr/bin/env bash
# Render Build Script for Home 2 Service Backend
# Ensures dependencies, WhiteNoise static files, and database migrations are ready.
set -o errexit

echo "==> [1/3] Installing dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

echo "==> [2/3] Collecting static files..."
python manage.py collectstatic --no-input

echo "==> [3/3] Applying database migrations safely..."
python manage.py migrate --no-input

echo "==> Backend build completed successfully!"
