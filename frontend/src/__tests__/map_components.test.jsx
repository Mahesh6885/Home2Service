import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LocationStatusIndicator from '../components/map/LocationStatusIndicator';
import CurrentLocationButton from '../components/map/CurrentLocationButton';
import { isWithinCoimbatoreRegion } from '../components/map/LocationPickerMap';

describe('Map Components & Geolocation Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isWithinCoimbatoreRegion boundary helper', () => {
    it('accurately identifies points inside Coimbatore metropolitan bounds', () => {
      // Gandhipuram
      expect(isWithinCoimbatoreRegion(11.0168, 76.9558)).toBe(true);
      // RS Puram
      expect(isWithinCoimbatoreRegion(11.0085, 76.9450)).toBe(true);
      // Peelamedu
      expect(isWithinCoimbatoreRegion(11.0250, 76.9950)).toBe(true);
      // Singanallur
      expect(isWithinCoimbatoreRegion(10.9980, 77.0200)).toBe(true);
    });

    it('rejects points far outside Coimbatore', () => {
      // Chennai
      expect(isWithinCoimbatoreRegion(13.0827, 80.2707)).toBe(false);
      // Bengaluru
      expect(isWithinCoimbatoreRegion(12.9716, 77.5946)).toBe(false);
      // London
      expect(isWithinCoimbatoreRegion(51.5074, -0.1278)).toBe(false);
    });
  });

  describe('LocationStatusIndicator', () => {
    it('renders "Location Unavailable" state with reason when isAvailable is false', () => {
      render(
        <LocationStatusIndicator
          isAvailable={false}
          reason="Worker has paused location sharing"
        />
      );
      expect(screen.getByText('Worker has paused location sharing')).toBeDefined();
    });

    it('renders fallback label when isAvailable is false and reason is empty', () => {
      render(<LocationStatusIndicator isAvailable={false} />);
      expect(screen.getByText('Location Unavailable')).toBeDefined();
    });

    it('renders stale badge when location updates are old', () => {
      const pastTime = new Date(Date.now() - 25 * 60 * 1000).toISOString(); // 25 mins ago
      render(
        <LocationStatusIndicator
          isAvailable={true}
          isStale={true}
          lastUpdated={pastTime}
        />
      );
      expect(screen.getByText(/Location last updated/i)).toBeDefined();
      expect(screen.getByText(/\(Stale\)/i)).toBeDefined();
    });

    it('renders active live tracking badge when location is fresh', () => {
      const now = new Date().toISOString();
      render(
        <LocationStatusIndicator
          isAvailable={true}
          isStale={false}
          lastUpdated={now}
        />
      );
      expect(screen.getByText(/Live Tracking Active/i)).toBeDefined();
    });
  });

  describe('CurrentLocationButton', () => {
    it('renders button and acquires browser geolocation successfully', async () => {
      const mockPosition = {
        coords: {
          latitude: 11.0168,
          longitude: 76.9558,
          accuracy: 15
        }
      };

      const mockGeolocation = {
        getCurrentPosition: vi.fn((success) => success(mockPosition))
      };
      // Mock global navigator
      vi.stubGlobal('navigator', {
        ...global.navigator,
        geolocation: mockGeolocation
      });

      const onAcquired = vi.fn();
      render(<CurrentLocationButton onLocationAcquired={onAcquired} buttonText="Locate Me" />);

      const button = screen.getByText('Locate Me');
      fireEvent.click(button);

      await waitFor(() => {
        expect(onAcquired).toHaveBeenCalledWith({
          latitude: 11.0168,
          longitude: 76.9558,
          accuracy: 15
        });
      });
    });

    it('handles geolocation permission denied or unavailable gracefully', async () => {
      const mockError = {
        code: 1,
        message: 'User denied Geolocation'
      };

      const mockGeolocation = {
        getCurrentPosition: vi.fn((_, error) => error(mockError))
      };
      vi.stubGlobal('navigator', {
        ...global.navigator,
        geolocation: mockGeolocation
      });

      const onAcquired = vi.fn();
      render(<CurrentLocationButton onLocationAcquired={onAcquired} />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText(/GPS access denied/i)).toBeDefined();
        expect(onAcquired).not.toHaveBeenCalled();
      });
    });
  });
});
