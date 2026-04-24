import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import mapboxgl from 'mapbox-gl';
import CampusMap from '../components/CampusMap';

// Mock mapbox-gl
vi.mock('mapbox-gl', () => ({
  default: {
    accessToken: '',
    Map: vi.fn().mockImplementation(function () {
      return {
        addControl: vi.fn(),
        on: vi.fn(),
        remove: vi.fn(),
        flyTo: vi.fn(),
      };
    }),
    NavigationControl: vi.fn(),
    GeolocateControl: vi.fn(),
    Marker: vi.fn().mockImplementation(function () {
      return {
        setLngLat: vi.fn().mockReturnThis(),
        addTo: vi.fn().mockReturnThis(),
        remove: vi.fn(),
      };
    }),
    Popup: vi.fn().mockImplementation(function () {
      return {
        setLngLat: vi.fn().mockReturnThis(),
        setHTML: vi.fn().mockReturnThis(),
        addTo: vi.fn().mockReturnThis(),
        remove: vi.fn(),
      };
    }),
  }
}));

// Mock LocationContext
vi.mock('../contexts/LocationContext', () => ({
  useLocation: () => ({
    requestLocationAccess: vi.fn(),
    userLocation: null,
  }),
}));

describe('CampusMap Quiet Zones Filter', () => {
  const buildings = [
    {
      _id: '1',
      name: 'Quiet Building',
      abbreviation: 'QB',
      latitude: 40.0,
      longitude: -86.0,
      noiseClassification: 'Quiet'
    },
    {
      _id: '2',
      name: 'Loud Building',
      abbreviation: 'LB',
      latitude: 40.1,
      longitude: -86.1,
      noiseClassification: 'Collaborative'
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('adds markers for all buildings when isQuietZonesOnly is false', () => {
    render(
      <CampusMap
        buildings={buildings}
        isQuietZonesOnly={false}
        setIsQuietZonesOnly={() => { }}
        onSelectBuilding={() => { }}
      />
    );

    expect(mapboxgl.Marker).toHaveBeenCalledTimes(2);
  });

  it('adds markers only for quiet buildings when isQuietZonesOnly is true', () => {
    render(
      <CampusMap
        buildings={buildings}
        isQuietZonesOnly={true}
        setIsQuietZonesOnly={() => { }}
        onSelectBuilding={() => { }}
      />
    );

    // Only 1 building has "Quiet", so only 1 mapbox marker should be instantiated
    expect(mapboxgl.Marker).toHaveBeenCalledTimes(1);
  });
});
