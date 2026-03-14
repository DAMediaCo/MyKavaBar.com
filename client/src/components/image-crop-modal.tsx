/**
 * ImageCropModal — circular crop UI for profile photos.
 * Uses react-easy-crop: drag to reposition, pinch/scroll to zoom.
 * Returns a cropped Blob via onCrop callback.
 */
import { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import { Loader2, ZoomIn, ZoomOut, Check, X } from "lucide-react";

interface Props {
  imageSrc: string;        // object URL of the selected file
  onCrop: (blob: Blob) => void;
  onCancel: () => void;
}

/** Extract the cropped pixels from the source image using a canvas */
async function getCroppedBlob(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = imageSrc;
  });

  const canvas = document.createElement("canvas");
  const size = Math.min(pixelCrop.width, pixelCrop.height); // square output
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    size,
    size,
  );

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Canvas toBlob failed"));
    }, "image/jpeg", 0.92);
  });
}

export default function ImageCropModal({ imageSrc, onCrop, onCancel }: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleSave = async () => {
    if (!croppedAreaPixels) return;
    setSaving(true);
    try {
      const blob = await getCroppedBlob(imageSrc, croppedAreaPixels);
      onCrop(blob);
    } catch (e) {
      console.error("Crop failed", e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors text-sm"
        >
          <X className="h-4 w-4" /> Cancel
        </button>
        <span className="text-white font-semibold text-sm">Adjust Photo</span>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 text-[#D35400] hover:text-orange-400 font-semibold text-sm disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      {/* Cropper */}
      <div className="relative flex-1">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={1}
          cropShape="round"
          showGrid={false}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
          style={{
            containerStyle: { background: "#000" },
            cropAreaStyle: {
              border: "2px solid #D35400",
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.7)",
            },
          }}
        />
      </div>

      {/* Zoom slider */}
      <div className="flex items-center gap-3 px-6 py-4 border-t border-white/10">
        <ZoomOut className="h-4 w-4 text-gray-500 shrink-0" />
        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="flex-1 accent-[#D35400] h-1.5 rounded-full"
        />
        <ZoomIn className="h-4 w-4 text-gray-500 shrink-0" />
      </div>

      <p className="text-center text-gray-600 text-xs pb-4">
        Drag to reposition · Pinch or slide to zoom
      </p>
    </div>
  );
}
