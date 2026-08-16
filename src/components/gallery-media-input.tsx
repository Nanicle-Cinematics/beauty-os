"use client";

import { useCallback, useRef, useState, type ClipboardEvent, type ChangeEvent } from "react";
import { ImagePlus, Link2, X } from "lucide-react";

const MAX_IMAGES = 24;
const MAX_IMAGE_BYTES = 8_000_000;
const MAX_EDGE = 1800;
const JPEG_QUALITY = 0.84;

type UploadedImage = {
  id: string;
  name: string;
  dataUrl: string;
};

function readFileAsImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read image."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not load image."));
      img.onload = () => resolve(img);
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

async function compressImage(file: File) {
  const image = await readFileAsImage(file);
  const ratio = Math.min(1, MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * ratio));
  const height = Math.max(1, Math.round(image.naturalHeight * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not prepare image.");
  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
}

export function GalleryMediaInput() {
  const [uploads, setUploads] = useState<UploadedImage[]>([]);
  const [notice, setNotice] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(async (files: File[]) => {
    setNotice("");
    const available = MAX_IMAGES - uploads.length;
    if (available <= 0) {
      setNotice(`You can add up to ${MAX_IMAGES} uploaded or pasted images at once.`);
      return;
    }

    const accepted: UploadedImage[] = [];
    for (const file of files.slice(0, available)) {
      if (!file.type.startsWith("image/")) {
        setNotice("Only image files can be pasted or uploaded here.");
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        setNotice(`${file.name} is too large. Use an image under 8MB.`);
        continue;
      }
      try {
        accepted.push({
          id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`,
          name: file.name || `Pasted image ${uploads.length + accepted.length + 1}`,
          dataUrl: await compressImage(file),
        });
      } catch {
        setNotice(`Could not process ${file.name || "that image"}.`);
      }
    }
    if (accepted.length > 0) setUploads((current) => [...current, ...accepted]);
  }, [uploads.length]);

  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(event.clipboardData.files).filter((file) => file.type.startsWith("image/"));
    if (files.length === 0) return;
    event.preventDefault();
    void addFiles(files);
  };

  const handleFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    void addFiles(files);
    event.target.value = "";
  };

  return (
    <div className="grid gap-3">
      <input type="hidden" name="mediaUploadDataUrls" value={uploads.map((upload) => upload.dataUrl).join("\n")} />
      <label className="field-label">
        Media URLs
        <div className="relative">
          <Link2 size={15} className="pointer-events-none absolute left-3 top-3.5 text-muted" />
          <textarea
            name="mediaUrls"
            rows={6}
            className="input pl-9"
            onPaste={handlePaste}
            placeholder="Paste one hosted image or video URL per line, or paste copied images here"
          />
        </div>
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-[12.5px] font-semibold text-ink hover:bg-sunken"
        >
          <ImagePlus size={14} /> Upload images
        </button>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} />
        <span className="text-xs font-semibold text-muted">{uploads.length} pasted/uploaded</span>
      </div>
      {notice ? <p className="text-xs font-semibold text-danger">{notice}</p> : null}
      {uploads.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {uploads.map((upload) => (
            <div key={upload.id} className="group relative aspect-[4/3] overflow-hidden rounded-2xl border border-line bg-sunken">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={upload.dataUrl} alt={upload.name} className="size-full object-cover" />
              <button
                type="button"
                onClick={() => setUploads((current) => current.filter((item) => item.id !== upload.id))}
                className="absolute right-2 top-2 grid size-8 place-items-center rounded-xl bg-black/55 text-white opacity-0 backdrop-blur transition group-hover:opacity-100"
                aria-label={`Remove ${upload.name}`}
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
