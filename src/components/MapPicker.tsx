import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { MapPin, Check } from 'lucide-react';

interface MapPickerProps {
  onLocationSelect: (lat: number, lng: number) => void;
  initialLat?: number;
  initialLng?: number;
}

export default function MapPicker({
  onLocationSelect,
  initialLat,
  initialLng,
}: MapPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onLocationSelectRef = useRef(onLocationSelect);
  const initialLatRef = useRef(initialLat);
  const initialLngRef = useRef(initialLng);

  useEffect(() => {
    onLocationSelectRef.current = onLocationSelect;
  }, [onLocationSelect]);

  useEffect(() => {
    initialLatRef.current = initialLat;
    initialLngRef.current = initialLng;
  }, [initialLat, initialLng]);
  const [selected, setSelected] = useState<{ lat: number; lng: number } | null>(
    initialLat && initialLng ? { lat: initialLat, lng: initialLng } : null
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const initialLatValue = initialLatRef.current;
    const initialLngValue = initialLngRef.current;
    const center: [number, number] =
      initialLatValue && initialLngValue ? [initialLatValue, initialLngValue] : [22.5937, 79.9629];

    const map = L.map(mapRef.current, {
      center,
      zoom: initialLatValue ? 14 : 5,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    if (initialLatRef.current && initialLngRef.current) {
      markerRef.current = L.marker([initialLatRef.current, initialLngRef.current]).addTo(map);
    }

    map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else {
        markerRef.current = L.marker([lat, lng]).addTo(map);
      }
      setSelected({ lat, lng });
      onLocationSelectRef.current(lat, lng);
    });

    mapInstance.current = map;
  }, []);

  const handleSearch = async () => {
    if (!searchQuery.trim() || !mapInstance.current) return;
    setSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          searchQuery
        )}&limit=1`,
        { headers: { Accept: 'application/json' } }
      );
      const results = await response.json();
      if (results && results.length > 0) {
        const { lat, lon } = results[0];
        const latNum = parseFloat(lat);
        const lonNum = parseFloat(lon);
        mapInstance.current.setView([latNum, lonNum], 14);
        if (markerRef.current) {
          markerRef.current.setLatLng([latNum, lonNum]);
        } else {
          markerRef.current = L.marker([latNum, lonNum]).addTo(mapInstance.current);
        }
        setSelected({ lat: latNum, lng: lonNum });
        onLocationSelectRef.current(latNum, lonNum);
      }
    } catch {
      // Silently fail — user can still click on map
    } finally {
      setSearching(false);
    }
  };

  const useMyLocation = () => {
    if (!navigator.geolocation || !mapInstance.current) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        mapInstance.current!.setView([latitude, longitude], 16);
        if (markerRef.current) {
          markerRef.current.setLatLng([latitude, longitude]);
        } else {
          markerRef.current = L.marker([latitude, longitude]).addTo(mapInstance.current!);
        }
        setSelected({ lat: latitude, lng: longitude });
        onLocationSelectRef.current(latitude, longitude);
      },
      () => {
        // User denied or geolocation unavailable
      }
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search for a location (e.g. MG Road, Bangalore)"
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-all"
          />
        </div>
        <button
          type="button"
          onClick={handleSearch}
          disabled={searching}
          className="px-4 py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-sm font-medium text-slate-700 transition-colors disabled:opacity-50"
        >
          {searching ? 'Searching…' : 'Search'}
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={useMyLocation}
          className="text-sm text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1.5"
        >
          <MapPin className="w-4 h-4" />
          Use my current location
        </button>
        {selected && (
          <span className="text-sm text-emerald-600 font-medium flex items-center gap-1 ml-auto">
            <Check className="w-4 h-4" />
            Location selected
          </span>
        )}
      </div>

      <div
        ref={mapRef}
        className="w-full h-[320px] rounded-xl overflow-hidden border border-slate-200 bg-slate-100"
      />

      {selected && (
        <p className="text-xs text-slate-500 font-mono">
          {selected.lat.toFixed(5)}, {selected.lng.toFixed(5)}
        </p>
      )}
    </div>
  );
}
