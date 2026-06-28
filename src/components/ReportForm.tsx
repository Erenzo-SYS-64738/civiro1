import React, { useState, useEffect } from 'react';
import { Camera, X, ArrowLeft, Loader2, MapPin, CheckCircle2, AlertCircle } from 'lucide-react';
import { NewTicketInput, Ticket } from '../types';
import { compressImage } from '../utils';
import TicketMap from './TicketMap';

interface ReportFormProps {
  onBack: () => void;
  onSubmit: (ticketData: NewTicketInput) => Promise<void>;
  tickets?: Ticket[];
}

const CATEGORIES = [
  { value: 'pothole', label: 'Pothole & Road Damage' },
  { value: 'streetlight', label: 'Streetlight & Electrical Outage' },
  { value: 'garbage', label: 'Trash & Illegal Dumping' },
  { value: 'water_leak', label: 'Water & Drainage Leak' }
];

export default function ReportForm({ onBack, onSubmit, tickets = [] }: ReportFormProps) {
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // GPS Coordinates state
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'acquiring' | 'success' | 'error'>('idle');
  const [gpsErrorMsg, setGpsErrorMsg] = useState('');

  // Auto capture GPS location on mount
  useEffect(() => {
    captureGPS();
  }, []);

  const getFallbackCoords = () => {
    if (tickets && tickets.length > 0) {
      const lats = tickets.map(t => t.lat);
      const lngs = tickets.map(t => t.lng);
      const avgLat = lats.reduce((sum, val) => sum + val, 0) / lats.length;
      const avgLng = lngs.reduce((sum, val) => sum + val, 0) / lngs.length;
      return { lat: avgLat, lng: avgLng };
    }
    return { lat: 20.5937, lng: 78.9629 }; // India default
  };

  const captureGPS = () => {
    if (!navigator.geolocation) {
      setGpsStatus('error');
      setGpsErrorMsg('Geolocation is not supported by your browser.');
      setCoords(getFallbackCoords());
      return;
    }

    setGpsStatus('acquiring');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        setGpsStatus('success');
      },
      (error) => {
        console.error('GPS acquisition failed:', error);
        setGpsStatus('error');
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setGpsErrorMsg('Location permission denied. Drag the map pin to select location.');
            break;
          case error.POSITION_UNAVAILABLE:
            setGpsErrorMsg('Position unavailable. Set location manually on the map.');
            break;
          case error.TIMEOUT:
            setGpsErrorMsg('GPS request timed out. Set location manually on the map.');
            break;
          default:
            setGpsErrorMsg('Could not fetch GPS location. Set location manually.');
        }
        setCoords(getFallbackCoords());
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processImageFile(file);
  };

  const processImageFile = async (file: File) => {
    setIsCompressing(true);
    try {
      const base64Img = await compressImage(file);
      setPhoto(base64Img);
    } catch (err) {
      console.error(err);
      alert('Failed to process image. Please try another file.');
    } finally {
      setIsCompressing(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      await processImageFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !coords || !photo) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        description: description.trim(),
        lat: coords.lat,
        lng: coords.lng,
        photo_before_url: photo
      });
    } catch (err) {
      console.error(err);
      alert('Error submitting report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div id="report-form-container" className="max-w-4xl mx-auto py-6 px-4 md:px-0">
      {/* Navigation Header */}
      <button
        id="btn-back-to-home"
        onClick={onBack}
        className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors font-semibold text-sm mb-6 cursor-pointer"
      >
        <ArrowLeft size={16} />
        Back to Dashboard
      </button>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-100/50 overflow-hidden">
        <div className="bg-slate-900 px-6 py-8 text-white">
          <h1 className="text-2xl font-bold tracking-tight">Report a Community Issue</h1>
          <p className="text-slate-300 text-sm mt-2">
            Submit local issues directly to the public map. Our smart AI agent will analyze your report, automatically assign categories, severity, and route it to the appropriate department.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-8">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Form Left Fields */}
            <div className="space-y-6">
              
              {/* Detailed Description */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Detailed Description <span className="text-rose-500">*</span>
                </label>
                <textarea
                  id="textarea-description"
                  required
                  rows={6}
                  placeholder="Describe the exact issue. E.g., Massive pothole in the left lane forcing cars to swerve suddenly, or street light completely dead near the pedestrian walk."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium resize-none"
                />
              </div>

              {/* Photo Attachment (Mandatory) */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Photo Attachment <span className="text-rose-500">*</span>
                </label>
                {photo ? (
                  <div className="relative group rounded-xl overflow-hidden border border-slate-200 bg-slate-50 aspect-video">
                    <img
                      src={photo}
                      alt="Uploaded preview"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() => setPhoto(null)}
                        className="bg-rose-600 hover:bg-rose-700 text-white rounded-full p-2.5 shadow-lg transition-transform hover:scale-105 cursor-pointer"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    className="border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-xl p-8 text-center cursor-pointer transition-colors bg-slate-50/50 group"
                  >
                    <input
                      id="input-photo-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                      required
                    />
                    <label htmlFor="input-photo-upload" className="cursor-pointer block">
                      {isCompressing ? (
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 size={32} className="text-blue-500 animate-spin" />
                          <span className="text-sm font-medium text-slate-600">Processing image...</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <div className="p-4 rounded-full bg-white shadow-sm border border-slate-100 text-slate-400 group-hover:text-blue-500 transition-colors">
                            <Camera size={28} />
                          </div>
                          <span className="text-sm font-semibold text-slate-700">Upload Issue Photo</span>
                          <span className="text-xs text-slate-400">Drag & drop or click to choose file</span>
                        </div>
                      )}
                    </label>
                  </div>
                )}
              </div>

            </div>

            {/* Map and GPS Selection (Right Column) */}
            <div className="flex flex-col h-full space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Map Location <span className="text-rose-500">*</span>
                </label>
                
                {/* Geolocation Status Badge */}
                <div className="mb-3 flex items-center justify-between gap-2 flex-wrap">
                  {gpsStatus === 'acquiring' && (
                    <div className="flex items-center gap-1.5 text-xs text-blue-600 font-medium bg-blue-50 border border-blue-100 rounded-full px-2.5 py-1">
                      <Loader2 size={12} className="animate-spin" />
                      <span>Acquiring GPS location...</span>
                    </div>
                  )}
                  {gpsStatus === 'success' && (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium bg-emerald-50 border border-emerald-100 rounded-full px-2.5 py-1">
                      <CheckCircle2 size={12} />
                      <span>GPS location acquired successfully!</span>
                    </div>
                  )}
                  {gpsStatus === 'error' && (
                    <div className="flex items-center gap-1.5 text-xs text-amber-600 font-medium bg-amber-50 border border-amber-100 rounded-full px-2.5 py-1">
                      <AlertCircle size={12} />
                      <span>{gpsErrorMsg}</span>
                    </div>
                  )}
                  
                  <button
                    type="button"
                    onClick={captureGPS}
                    className="text-xs text-slate-600 hover:text-blue-600 font-bold underline cursor-pointer"
                  >
                    Refresh GPS
                  </button>
                </div>
              </div>

              {/* Map container */}
              <div className="flex-1 min-h-[300px] relative rounded-2xl overflow-hidden border border-slate-100 shadow-inner bg-slate-50">
                {coords && (
                  <TicketMap
                    tickets={tickets}
                    selectedTicket={null}
                    onSelectTicket={() => {}}
                    isReportingMode={true}
                    reportCoords={coords}
                    onReportCoordsChange={(newCoords) => setCoords(newCoords)}
                    defaultCenter={[coords.lat, coords.lng]}
                  />
                )}
              </div>

              {coords && (
                <div className="bg-slate-50 rounded-xl px-4 py-3 border border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-600">
                    <MapPin size={16} className="text-blue-500 shrink-0" />
                    <div className="text-xs">
                      <span className="font-semibold block text-slate-800">Pin Coordinates</span>
                      <span>{coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}</span>
                    </div>
                  </div>
                  <div className="text-[10px] uppercase font-bold text-slate-400 bg-white border border-slate-100 rounded px-2 py-0.5">
                    Drag Pin to Adjust
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Form Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onBack}
              className="px-5 py-3 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors font-semibold text-sm cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !coords || !photo || isCompressing}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:text-slate-500 text-white rounded-xl shadow-lg hover:shadow-blue-600/20 transition-all font-semibold text-sm flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>AI Agent Categorizing & Routing...</span>
                </>
              ) : (
                <span>Submit Ticket</span>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
