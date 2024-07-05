import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import axios from 'axios';
import { Searcher } from './Searcher'; // Import the Searcher function

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_API_KEY;

const Map = ({ markerConfig = [0.5, 0.7] }) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [location, setLocation] = useState('');
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [circlesData, setCirclesData] = useState({
    type: 'FeatureCollection',
    features: [],
  });

  useEffect(() => {
    if (map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v11',
      center: [0, 0],
      zoom: 2,
    });

    map.current.on('load', () => {
      map.current.addSource('places', {
        type: 'geojson',
        data: circlesData,
      });

      map.current.addLayer({
        id: 'places-layer',
        type: 'circle',
        source: 'places',
        paint: {
          'circle-radius': [
            'match',
            ['get', 'type'],
            'restaurant', 20 * markerConfig[0],
            'religious', 20 * markerConfig[1],
            10,
          ],
          'circle-color': [
            'match',
            ['get', 'type'],
            'restaurant', 'red',
            'religious', 'green',
            'blue', // Default color for the main location
          ],
          'circle-opacity': [
            'match',
            ['get', 'type'],
            'restaurant', markerConfig[0],
            'religious', markerConfig[1],
            1,
          ],
        },
      });

      // Add click event listener for circles
      map.current.on('click', 'places-layer', (e) => {
        const coordinates = e.features[0].geometry.coordinates.slice();
        const { name, location } = e.features[0].properties;

        new mapboxgl.Popup({ offset: 25 }) // Add offset to ensure popup is visible near the spot
          .setLngLat(coordinates)
          .setHTML(`<h3>${name || 'Location'}</h3><p>${location || ''}</p>`)
          .addTo(map.current);
      });

      // Change the cursor to a pointer when the mouse is over the places layer
      map.current.on('mouseenter', 'places-layer', () => {
        map.current.getCanvas().style.cursor = 'pointer';
      });

      // Change it back to a pointer when it leaves
      map.current.on('mouseleave', 'places-layer', () => {
        map.current.getCanvas().style.cursor = '';
      });
    });
  }, []);

  useEffect(() => {
    if (map.current.getSource('places')) {
      map.current.getSource('places').setData(circlesData);
    }
  }, [circlesData]);

  const handleLocationSelect = async (location) => {
    setLocation(location.place_name);
    setLocationSuggestions([]);
    const center = location.geometry.coordinates;

    map.current.flyTo({ center, zoom: 14 });

    // Feed the location address (not geocoded) to the Searcher function
    const ngoLocations = [`Location, ${location.place_name}, City`]; // Adjust as needed
    const results = await Searcher(ngoLocations);

    // Prepare the data for circles
    const newFeatures = [];

    // Add the main location circle
    newFeatures.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: center,
      },
      properties: {
        type: 'main',
        name: 'Entered Location',
        location: location.place_name,
      },
    });

    results.forEach(result => {
      const { nearbyPlaces } = result;

      // Add restaurants
      nearbyPlaces.restaurants.forEach(place => {
        newFeatures.push({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: place.coordinates,
          },
          properties: {
            type: 'restaurant',
            name: place.name,
            location: place.location,
          },
        });
      });

      // Add religious places
      nearbyPlaces.religious.forEach(place => {
        newFeatures.push({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: place.coordinates,
          },
          properties: {
            type: 'religious',
            name: place.name,
            location: place.location,
          },
        });
      });
    });

    setCirclesData({
      type: 'FeatureCollection',
      features: newFeatures,
    });
  };

  const fetchSuggestions = async (query) => {
    try {
      const response = await axios.get(`https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json`, {
        params: {
          access_token: mapboxgl.accessToken,
          autocomplete: true,
          limit: 5,
        },
      });
      setLocationSuggestions(response.data.features);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    }
  };

  const handleLocationChange = (e) => {
    const value = e.target.value;
    setLocation(value);
    if (value.length > 2) {
      fetchSuggestions(value);
    } else {
      setLocationSuggestions([]);
    }
  };

  return (
    <div className="relative h-screen flex flex-col">
      <div className="p-4 bg-white shadow-lg z-10 flex items-center justify-center w-full">
        <div className="w-full flex flex-col md:flex-row gap-4 items-center justify-center">
          <div className="relative flex-1 w-full max-w-md md:max-w-lg lg:max-w-xl">
            <input
              type="text"
              placeholder="Enter location"
              value={location}
              onChange={handleLocationChange}
              className="w-full p-3 border rounded-full text-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
            {locationSuggestions.length > 0 && (
              <ul className="absolute bg-background-100 border border-gray-300 rounded shadow-md mt-1 w-full z-20">
                {locationSuggestions.map((suggestion) => (
                  <li
                    key={suggestion.id}
                    className="p-2 cursor-pointer hover:bg-background-200"
                    onClick={() => handleLocationSelect(suggestion)}
                  >
                    {suggestion.place_name}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button className="px-4 py-2 bg-orange-500 text-white rounded-full shadow-md hover:bg-orange-600">
            Get Route
          </button>
        </div>
      </div>
      <div ref={mapContainer} className="flex-1 z-0" style={{ width: '100%', height: '100%' }}></div>
    </div>
  );
};

export default Map;
