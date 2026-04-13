import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import CampusMap from '../components/CampusMap';

// Mock mapbox-gl
jest.mock('mapbox-gl', () => ({
  Map: jest.fn(() => ({
    addControl: jest.fn(),
    on: jest.fn(),
    remove: jest.fn(),
    flyTo: jest.fn(),
  })),
  NavigationControl: jest.fn(),
  GeolocateControl: jest.fn(),
  Marker: jest.fn(() => ({
    setLngLat: jest.fn().mockReturnThis(),
    addTo: jest.fn().mockReturnThis(),
    remove: jest.fn(),
  })),
  Popup: jest.fn(() => ({
    setLngLat: jest.fn().mockReturnThis(),
    setHTML: jest.fn().mockReturnThis(),
    addTo: jest.fn().mockReturnThis(),
    remove: jest.fn(),
  })),
}));

// Mock LocationContext
jest.mock('../contexts/LocationContext', () => ({
  useLocation: () => ({
    requestLocationAccess: jest.fn(),
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
    const mockSetIsQuietZonesOnly = jest.fn();
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
