import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import CampusMap from '../components/CampusMap';

// Mock mapbox-gl
vi.mock('mapbox-gl', () => ({
  Map: vi.fn(() => ({
    addControl: vi.fn(),
    on: vi.fn(),
    remove: vi.fn(),
    flyTo: vi.fn(),
  })),
  NavigationControl: vi.fn(),
  GeolocateControl: vi.fn(),
  Marker: vi.fn(() => ({
    setLngLat: vi.fn().mockReturnThis(),
    addTo: vi.fn().mockReturnThis(),
    remove: vi.fn(),
  })),
  Popup: vi.fn(() => ({
    setLngLat: vi.fn().mockReturnThis(),
    setHTML: vi.fn().mockReturnThis(),
    addTo: vi.fn().mockReturnThis(),
    remove: vi.fn(),
  })),
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

  it('renders Quiet Zones toggle filter', () => {
    render(
      <CampusMap 
        buildings={buildings} 
        isQuietZonesOnly={false} 
        setIsQuietZonesOnly={() => {}} 
      />
    );
    expect(screen.getByText('Quiet Zones Only')).toBeInTheDocument();
  });

  it('calls setIsQuietZonesOnly when filter is clicked', () => {
    const mockSetIsQuietZonesOnly = vi.fn();
    render(
      <CampusMap 
        buildings={buildings} 
        isQuietZonesOnly={false} 
        setIsQuietZonesOnly={mockSetIsQuietZonesOnly} 
      />
    );
    
    // Find the toggle button which has aria-pressed
    const toggleButton = screen.getByRole('button', { pressed: false });
    fireEvent.click(toggleButton);
    expect(mockSetIsQuietZonesOnly).toHaveBeenCalledWith(true);
  });
});
