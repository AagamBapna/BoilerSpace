import { createContext, useContext, useState, useEffect } from 'react';

const LocationContext = createContext();

export function LocationProvider({ children }) {
    // 'prompt', 'granted', 'denied'
    const [locationStatus, setLocationStatus] = useState(() => {
        return localStorage.getItem('boilerSpace_locationStatus') || 'prompt';
    });
    const [userLocation, setUserLocation] = useState(null);
    const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);

    // Callback queue to run after location is successfully granted
    const [onSuccessCallbacks, setOnSuccessCallbacks] = useState([]);

    useEffect(() => {
        localStorage.setItem('boilerSpace_locationStatus', locationStatus);

        // Always check natively if the permission was revoked in browser
        if (navigator.permissions) {
            navigator.permissions.query({ name: 'geolocation' }).then((result) => {
                // Only auto-sync denial. Do NOT auto-sync 'granted' because 
                // the user might want it explicitly disabled within our app's UI overriding the browser!
                if (result.state === 'denied' && locationStatus !== 'denied') {
                    setLocationStatus('denied');
                    setUserLocation(null);
                }
            });
        }

        if (locationStatus === 'granted') {
            getCurrentLocation();
        }
    }, [locationStatus]);

    const getCurrentLocation = (onSuccess) => {
        if (!navigator.geolocation) {
            setLocationStatus('denied');
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const coords = [position.coords.longitude, position.coords.latitude];
                setUserLocation(coords);
                setLocationStatus('granted');
                if (onSuccess) onSuccess(coords);
            },
            (error) => {
                console.error('Error getting location:', error);

                // If they previously said granted, but mapping failed natively, it's denied
                if (error.code === error.PERMISSION_DENIED) {
                    setLocationStatus('denied');
                }
            },
            { enableHighAccuracy: true }
        );
    };

    const requestLocationAccess = (onSuccess) => {
        // If already granted, just return the location
        if (locationStatus === 'granted' && userLocation) {
            if (onSuccess) onSuccess(userLocation);
            return;
        } else if (locationStatus === 'granted' && !userLocation) {
            getCurrentLocation(onSuccess);
            return;
        }

        // If 'denied', we might want to tell them how to enable it
        if (locationStatus === 'denied') {
            alert('Location access is denied. Please enable it in your browser settings to use this feature.');
            return;
        }

        if (onSuccess) {
            setOnSuccessCallbacks(prev => [...prev, onSuccess]);
        }
        setIsPromptModalOpen(true);
    };

    const disableLocationAccess = () => {
        setLocationStatus('denied');
        setUserLocation(null);
    };

    const resetLocationStatus = () => {
        if (navigator.permissions) {
            navigator.permissions.query({ name: 'geolocation' }).then((result) => {
                if (result.state === 'denied') {
                    alert('You have permanently blocked location access in your browser. Please click the padlock icon in your address bar, change Location to Allow, and refresh the page to enable this feature.');
                } else if (result.state === 'granted') {
                    // If natively granted, bypass the prompt and just grab the location
                    setLocationStatus('granted');
                    getCurrentLocation();
                } else {
                    // State is 'prompt', ask them via our beautiful modal
                    setLocationStatus('prompt');
                    setIsPromptModalOpen(true);
                }
            });
        } else {
            setLocationStatus('prompt');
            setIsPromptModalOpen(true);
        }
    };

    const handleModalAllow = () => {
        setIsPromptModalOpen(false);
        getCurrentLocation((coords) => {
            onSuccessCallbacks.forEach(cb => cb(coords));
            setOnSuccessCallbacks([]);
        });
    };

    const handleModalDeny = () => {
        setIsPromptModalOpen(false);
        setLocationStatus('denied');
        setOnSuccessCallbacks([]);
    };

    return (
        <LocationContext.Provider value={{
            locationStatus,
            userLocation,
            requestLocationAccess,
            resetLocationStatus,
            disableLocationAccess,
            isPromptModalOpen,
            handleModalAllow,
            handleModalDeny
        }}>
            {children}
        </LocationContext.Provider>
    );
}

export const useLocation = () => useContext(LocationContext);
