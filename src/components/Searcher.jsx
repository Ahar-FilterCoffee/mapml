import mapboxgl from 'mapbox-gl';

// Set your Mapbox access token here
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_API_KEY;

// Function to search nearby places using Mapbox Geocoding API
export const Searcher = async (ngoLocations) => {
    const results = [];

    // Function to geocode location to get coordinates
    const geocodeLocation = async (location) => {
        try {
            const response = await fetch(
                `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(location)}.json?access_token=${mapboxgl.accessToken}`
            );
            const data = await response.json();
            if (data.features.length > 0) {
                const { center } = data.features[0];
                return center;
            } else {
                throw new Error('Location not found');
            }
        } catch (error) {
            console.error('Error geocoding location:', error);
            return null;
        }
    };

    // Function to search places within a bounding box
    const searchPlacesInBBox = async (lng, lat, type) => {
        const bbox = [
            lng - 0.025, // southwest longitude
            lat - 0.025, // southwest latitude
            lng + 0.025, // northeast longitude
            lat + 0.025  // northeast latitude
        ];

        try {
            const response = await fetch(
                `https://api.mapbox.com/geocoding/v5/mapbox.places/${type}.json?bbox=${bbox.join(',')}&access_token=${mapboxgl.accessToken}&types=poi&limit=50`
            );
            const data = await response.json();
            console.log(data);

            // Filter for specific POI category
            const filteredPlaces = data.features.map(feature => ({
                id: feature.id,
                name: feature.text,
                location: feature.place_name,
                coordinates: feature.center,
                type: feature.properties.category
            }));

            return filteredPlaces;
        } catch (error) {
            console.error('Error searching places within bbox:', error);
            return [];
        }
    };

    // Process each NGO location
    for (const ngo of ngoLocations) {
        const [ngoName, location, city] = ngo.split(',').map(str => str.trim());
        const coordinates = await geocodeLocation(`${location}, ${city}`);

        if (coordinates) {
            const ngoResults = { name: ngoName, location: { name: location, city }, nearbyPlaces: {} };

            // Search for restaurants
            const restaurants = await searchPlacesInBBox(coordinates[0], coordinates[1], 'restaurant');
            ngoResults.nearbyPlaces.restaurants = restaurants;

            // Search for religious places
            const religiousPlaces = await searchPlacesInBBox(coordinates[0], coordinates[1], 'temple');
            ngoResults.nearbyPlaces.religious = religiousPlaces;

            

            results.push(ngoResults);
        } else {
            console.error(`Coordinates not found for ${ngoName}, ${location}, ${city}`);
        }
    }
    return results;
};
