import React, { useEffect, useState } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

export const MapsWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [key, setKey] = useState<string | null>(null);

  useEffect(() => {
    // In this environment, secrets are available via an internal mechanism.
    // We check the env variable first, which is populated by AI Studio.
    if (API_KEY && API_KEY !== "YOUR_GOOGLE_MAPS_API_KEY") {
      setKey(API_KEY);
    } else {
      // If the key is missing or placeholder, this will fail in production.
      console.error("Google Maps API Key is missing.");
    }
  }, []);

  if (!key) {
    return <div className="p-4 bg-red-50 text-red-600 rounded-lg">Maps API Key configuration error.</div>;
  }

  return (
    <APIProvider apiKey={key} version="weekly">
      {children}
    </APIProvider>
  );
};
