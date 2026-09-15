import { useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import type { Report } from '@/lib/types';
import { CATEGORY_COLORS, CATEGORY_LABELS } from '@/lib/types';
import type { HeatmapPoint } from '@/lib/analytics';

interface MapViewProps {
  reports: Report[];
  onMarkerClick?: (report: Report) => void;
  center?: [number, number];
  zoom?: number;
  className?: string;
  selectedId?: string | null;
  heatmapPoints?: HeatmapPoint[];
  showHeatmap?: boolean;
}

function createDivIcon(color: string, isSelected: boolean): L.DivIcon {
  const size = isSelected ? 20 : 14;
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="position: relative; display: flex; align-items: center; justify-content: center;">
        <div class="marker-pulse" style="
          position: absolute;
          width: ${size + 8}px;
          height: ${size + 8}px;
          border-radius: 50%;
          background: ${color};
        "></div>
        <div style="
          position: relative;
          width: ${size}px;
          height: ${size}px;
          border-radius: 50%;
          background: ${color};
          border: 2px solid white;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        "></div>
      </div>
    `,
    iconSize: [size + 8, size + 8],
    iconAnchor: [(size + 8) / 2, (size + 8) / 2],
  });
}

function createHeatmapLayer(points: HeatmapPoint[]): L.Layer {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const size = 256;
  canvas.width = size;
  canvas.height = size;

  const maxIntensity = Math.max(...points.map((p) => p.intensity), 1);

  const radius = 25;

  points.forEach((point) => {
    const x = (point.longitude + 180) / 360 * size;
    const y = (1 - Math.log(Math.tan(point.latitude * Math.PI / 180) + 1 / Math.cos(point.latitude * Math.PI / 180)) / Math.PI) / 2 * size;
    const intensity = point.intensity / maxIntensity;

    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `rgba(239, 68, 68, ${intensity * 0.8})`);
    gradient.addColorStop(0.5, `rgba(249, 115, 22, ${intensity * 0.6})`);
    gradient.addColorStop(1, `rgba(239, 68, 68, 0)`);

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
  });

  return L.imageOverlay(canvas.toDataURL(), [[-90, -180], [90, 180]], {
    opacity: 0.7,
    interactive: false,
  });
}

export default function MapView({
  reports,
  onMarkerClick,
  center = [22.5937, 79.9629],
  zoom = 5,
  className = '',
  selectedId = null,
  heatmapPoints = [],
  showHeatmap = false,
}: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});
  const heatmapLayerRef = useRef<L.Layer | null>(null);

  const heatmapLayer = useMemo(() => {
    if (heatmapPoints.length === 0) return null;
    return createHeatmapLayer(heatmapPoints);
  }, [heatmapPoints]);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const map = L.map(mapRef.current, {
      center,
      zoom,
      zoomControl: true,
      scrollWheelZoom: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    mapInstance.current = map;
  }, [center, zoom]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    if (showHeatmap && heatmapLayer) {
      if (heatmapLayerRef.current) {
        map.removeLayer(heatmapLayerRef.current);
      }
      heatmapLayerRef.current = heatmapLayer;
      heatmapLayer.addTo(map);
    } else if (heatmapLayerRef.current) {
      map.removeLayer(heatmapLayerRef.current);
      heatmapLayerRef.current = null;
    }
  }, [showHeatmap, heatmapLayer]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    if (showHeatmap) return;

    Object.values(markersRef.current).forEach((m) => m.remove());
    markersRef.current = {};

    reports.forEach((report) => {
      const color = CATEGORY_COLORS[report.category] || '#64748b';
      const isSelected = report.id === selectedId;
      const icon = createDivIcon(color, isSelected);

      const marker = L.marker([report.latitude, report.longitude], { icon })
        .addTo(map);

      if (onMarkerClick) {
        marker.on('click', () => onMarkerClick(report));
      }

      marker.bindTooltip(
        `${CATEGORY_LABELS[report.category]} · ${report.upvotes} upvotes`,
        { direction: 'top', offset: [0, -10] }
      );

      markersRef.current[report.id] = marker;
    });
  }, [reports, onMarkerClick, selectedId, showHeatmap]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !selectedId || showHeatmap) return;
    const report = reports.find((r) => r.id === selectedId);
    if (report) {
      map.setView([report.latitude, report.longitude], Math.max(map.getZoom(), 14), {
        animate: true,
      });
    }
  }, [selectedId, reports, showHeatmap]);

  return <div ref={mapRef} className={className} style={{ width: '100%', height: '100%' }} />;
}
