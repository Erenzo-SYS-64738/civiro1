import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Ticket } from '../types';

interface TicketMapProps {
  tickets: Ticket[];
  selectedTicket: Ticket | null;
  onSelectTicket: (ticket: Ticket) => void;
  isReportingMode?: boolean;
  reportCoords?: { lat: number; lng: number } | null;
  onReportCoordsChange?: (coords: { lat: number; lng: number }) => void;
  defaultCenter?: [number, number];
}

export default function TicketMap({
  tickets,
  selectedTicket,
  onSelectTicket,
  isReportingMode = false,
  reportCoords,
  onReportCoordsChange,
  defaultCenter = [20.5937, 78.9629] // India default rather than SF
}: TicketMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<L.Map | null>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});
  const reportMarkerRef = useRef<L.Marker | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || map) return;

    let initialCenter = defaultCenter;
    let initialZoom = 5; // Good zoom to show India
    let boundsToFit: L.LatLngBounds | null = null;

    if (isReportingMode && reportCoords) {
      initialCenter = [reportCoords.lat, reportCoords.lng];
      initialZoom = 15;
    } else if (selectedTicket) {
      initialCenter = [selectedTicket.lat, selectedTicket.lng];
      initialZoom = 15;
    } else if (tickets && tickets.length > 0) {
      const points = tickets.map(t => L.latLng(t.lat, t.lng));
      boundsToFit = L.latLngBounds(points);
    }

    const mapInstance = L.map(mapContainerRef.current, {
      zoomControl: true,
      attributionControl: true
    });

    if (boundsToFit) {
      mapInstance.fitBounds(boundsToFit, { padding: [50, 50], maxZoom: 14 });
    } else {
      mapInstance.setView(initialCenter, initialZoom);
    }

    // Add OpenStreetMap tile layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 20
    }).addTo(mapInstance);

    setMap(mapInstance);

    // Invalidate size after mounting to prevent partial rendering issues
    setTimeout(() => {
      mapInstance.invalidateSize();
    }, 150);

    // Watch container resize
    const resizeObserver = new ResizeObserver(() => {
      mapInstance.invalidateSize();
    });
    
    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      mapInstance.remove();
      setMap(null);
    };
  }, []);

  // Handle Map Click in Reporting Mode
  useEffect(() => {
    if (!map || !isReportingMode || !onReportCoordsChange) return;

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      onReportCoordsChange({ lat, lng });
    };

    map.on('click', handleMapClick);

    return () => {
      map.off('click', handleMapClick);
    };
  }, [map, isReportingMode, onReportCoordsChange]);

  // Handle reporting marker update
  useEffect(() => {
    if (!map) return;

    if (!isReportingMode) {
      if (reportMarkerRef.current) {
        reportMarkerRef.current.remove();
        reportMarkerRef.current = null;
      }
      return;
    }

    if (reportCoords) {
      const reportIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `
          <div class="relative flex items-center justify-center">
            <span class="absolute inline-flex h-10 w-10 animate-ping rounded-full bg-blue-400 opacity-75"></span>
            <div class="relative flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 shadow-lg text-white border-2 border-white">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
            </div>
          </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
      });

      if (reportMarkerRef.current) {
        reportMarkerRef.current.setLatLng([reportCoords.lat, reportCoords.lng]);
      } else {
        reportMarkerRef.current = L.marker([reportCoords.lat, reportCoords.lng], {
          icon: reportIcon,
          draggable: true
        }).addTo(map);

        reportMarkerRef.current.on('dragend', (event) => {
          const marker = event.target;
          const position = marker.getLatLng();
          if (onReportCoordsChange) {
            onReportCoordsChange({ lat: position.lat, lng: position.lng });
          }
        });
      }

      // Pan to reporting marker
      map.panTo([reportCoords.lat, reportCoords.lng]);
    } else {
      if (reportMarkerRef.current) {
        reportMarkerRef.current.remove();
        reportMarkerRef.current = null;
      }
    }
  }, [map, isReportingMode, reportCoords]);

  // Update Ticket Markers
  useEffect(() => {
    if (!map || isReportingMode) {
      // Clear markers if we switch to reporting mode
      if (isReportingMode) {
        Object.keys(markersRef.current).forEach(id => {
          markersRef.current[id].remove();
          delete markersRef.current[id];
        });
      }
      return;
    }

    // Clear old markers that are no longer in tickets
    const ticketIds = new Set(tickets.map(t => t.id));
    Object.keys(markersRef.current).forEach(id => {
      if (!ticketIds.has(id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });

    // Add or update markers for tickets
    tickets.forEach(ticket => {
      const isSelected = selectedTicket?.id === ticket.id;
      
      // Select marker color based on status
      let bgColor = 'bg-rose-500'; // Open
      let pingColor = 'bg-rose-400';
      if (ticket.status === 'Resolved Claimed') {
        bgColor = 'bg-amber-500';
        pingColor = 'bg-amber-400';
      } else if (ticket.status === 'Verified Resolved') {
        bgColor = 'bg-emerald-500';
        pingColor = 'bg-emerald-400';
      } else if (ticket.status === 'Reopened') {
        bgColor = 'bg-red-600';
        pingColor = 'bg-red-500';
      }

      const activeClass = isSelected ? 'scale-125 z-[1000] ring-4 ring-offset-2 ring-blue-500' : '';

      // Clean HTML custom pin using Tailwind classes
      const markerHtml = `
        <div class="relative flex items-center justify-center transition-all duration-300 ${activeClass}">
          ${isSelected ? `<span class="absolute inline-flex h-12 w-12 animate-ping rounded-full ${pingColor} opacity-50"></span>` : ''}
          <div class="relative flex h-8 w-8 items-center justify-center rounded-full ${bgColor} shadow-md text-white border-2 border-white">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'custom-ticket-icon',
        html: markerHtml,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      if (markersRef.current[ticket.id]) {
        markersRef.current[ticket.id].setLatLng([ticket.lat, ticket.lng]);
        markersRef.current[ticket.id].setIcon(customIcon);
      } else {
        const marker = L.marker([ticket.lat, ticket.lng], {
          icon: customIcon
        })
          .addTo(map)
          .on('click', () => {
            onSelectTicket(ticket);
          });
        markersRef.current[ticket.id] = marker;
      }
    });
  }, [map, tickets, selectedTicket, isReportingMode]);

  // Center on Selected Ticket
  useEffect(() => {
    if (!map || !selectedTicket || isReportingMode) return;
    
    map.setView([selectedTicket.lat, selectedTicket.lng], 15, {
      animate: true,
      duration: 1.0
    });
  }, [map, selectedTicket, isReportingMode]);

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-inner border border-gray-100 bg-gray-50">
      <div id="map" ref={mapContainerRef} className="w-full h-full" style={{ minHeight: '300px' }} />
      
      {isReportingMode && (
        <div className="absolute top-3 left-1/2 transform -translate-x-1/2 bg-white/95 backdrop-blur-md text-xs font-semibold px-4 py-2 rounded-full shadow-md text-slate-800 border border-slate-200/50 flex items-center gap-2 z-[999] pointer-events-none whitespace-nowrap">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
          <span>Click anywhere or drag the blue pin to adjust location</span>
        </div>
      )}
    </div>
  );
}
