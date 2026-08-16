"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Heart, ImageOff, Maximize2, MessageCircle, Play, Search, Share2, X, ZoomIn } from "lucide-react";
import { commentOnGalleryAction, favoriteGalleryMediaAction, recordGalleryMediaViewAction } from "@/lib/gallery-actions";

type GalleryMedia = {
  id: string;
  type: "IMAGE" | "VIDEO";
  url: string;
  originalUrl: string;
  title: string;
  category: string;
  favorite: boolean;
  watermark: string;
  watermarkStyle: { opacity: number; rotate: number; top: string; left: string };
};

type PublicGallery = {
  id: string;
  token: string;
  title: string;
  business: { name: string; logoUrl: string | null; phone: string | null; email: string | null };
  client: string;
  status: string;
  appointmentDate: string;
  artist: string;
  service: string;
  unlocked: boolean;
  payment: { projectTotal: string; depositPaid: string; balance: string; status: string; invoiceNumber: string | null };
  media: GalleryMedia[];
  comments: { id: string; mediaId: string | null; author: string; body: string; when: string }[];
  categories: string[];
};

function UnavailableMedia({ title, className }: { title: string; className: string }) {
  return (
    <div className={`grid place-items-center bg-white/[0.05] text-center text-white/54 ${className}`}>
      <div className="grid justify-items-center gap-2 px-5">
        <ImageOff size={24} className="text-[#f1d59b]/75" />
        <div>
          <div className="text-sm font-semibold text-white/78">Image unavailable</div>
          <div className="mt-1 max-w-56 truncate text-xs text-white/42">{title}</div>
        </div>
      </div>
    </div>
  );
}

function isPreviewableImageUrl(url: string) {
  try {
    const parsed = new URL(url);
    return !(parsed.hostname === "drive.google.com" && parsed.pathname.startsWith("/drive/folders/"));
  } catch {
    return /^data:image\//i.test(url);
  }
}

function GalleryImage({ media, className, fallbackClassName }: { media: GalleryMedia; className: string; fallbackClassName: string }) {
  const [failedImage, setFailedImage] = useState<string | null>(null);

  if (!isPreviewableImageUrl(media.url) || failedImage === media.url) {
    return <UnavailableMedia title={media.title} className={fallbackClassName} />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={media.url} alt={media.title} className={className} onError={() => setFailedImage(media.url)} draggable={false} />
  );
}

export function ClientGalleryViewer({ gallery }: { gallery: PublicGallery }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [slideshow, setSlideshow] = useState(false);
  const recordedViews = useRef(new Set<string>());
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return gallery.media.filter((media) => {
      const matchesCategory = category === "All" || media.category === category;
      const matchesQuery = !q || media.title.toLowerCase().includes(q) || media.category.toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });
  }, [category, gallery.media, query]);

  const selectedMedia = selected == null ? null : filtered[selected] ?? null;

  useEffect(() => {
    if (!selectedMedia || recordedViews.current.has(selectedMedia.id)) return;
    recordedViews.current.add(selectedMedia.id);
    void recordGalleryMediaViewAction(gallery.token, selectedMedia.id);
  }, [gallery.token, selectedMedia]);

  useEffect(() => {
    if (!slideshow || filtered.length === 0) return;
    const timer = window.setInterval(() => {
      setSelected((current) => {
        const next = current == null ? 0 : (current + 1) % filtered.length;
        return next;
      });
    }, 3600);
    return () => window.clearInterval(timer);
  }, [filtered.length, slideshow]);

  return (
    <div className="min-h-screen bg-[#130b16] text-white">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#130b16]/82 px-4 py-3 backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex max-w-7xl items-center gap-3">
          {gallery.business.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={gallery.business.logoUrl} alt="" className="size-11 rounded-2xl object-cover" />
          ) : (
            <span className="grid size-11 place-items-center rounded-2xl bg-white/10 font-serif text-lg font-semibold text-[#f1d59b]">
              {gallery.business.name.slice(0, 1)}
            </span>
          )}
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{gallery.business.name}</div>
            <div className="truncate text-xs text-white/48">{gallery.service} · {gallery.appointmentDate}</div>
          </div>
          <div className="ml-auto hidden items-center gap-2 sm:flex">
            <button onClick={() => setSlideshow((v) => !v)} className="rounded-2xl border border-white/15 px-3 py-2 text-xs font-semibold text-white/75 hover:bg-white/10">
              <Play size={13} className="mr-1 inline" /> {slideshow ? "Stop" : "Slideshow"}
            </button>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${gallery.unlocked ? "bg-emerald-400/15 text-emerald-200" : "bg-[#f1d59b]/15 text-[#f1d59b]"}`}>
              {gallery.payment.status}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6">
        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div>
            <div className="inline-flex rounded-full border border-[#f1d59b]/20 bg-[#f1d59b]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#f1d59b]">
              Secure Client Gallery
            </div>
            <h1 className="mt-4 font-serif text-4xl font-semibold tracking-tight sm:text-5xl">{gallery.title}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/58">
              Prepared for {gallery.client} by {gallery.artist}. Preview images are protected with dynamic watermarks until final payment is confirmed.
            </p>
            <p className="mt-2 max-w-2xl text-xs leading-5 text-white/38">
              Screenshot and screen recording detection is limited by browser and device support. Protection relies primarily on watermarking, access control and locked originals.
            </p>
          </div>

          <aside className="rounded-[28px] border border-white/10 bg-white/[0.06] p-5 shadow-2xl backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold">Payment unlock</h2>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${gallery.unlocked ? "bg-emerald-400/15 text-emerald-200" : "bg-[#f1d59b]/15 text-[#f1d59b]"}`}>
                {gallery.unlocked ? "Unlocked" : "Locked"}
              </span>
            </div>
            <div className="mt-4 grid gap-2 text-sm">
              <div className="flex justify-between gap-4"><span className="text-white/48">Project total</span><strong>{gallery.payment.projectTotal}</strong></div>
              <div className="flex justify-between gap-4"><span className="text-white/48">Deposit paid</span><strong>{gallery.payment.depositPaid}</strong></div>
              <div className="flex justify-between gap-4"><span className="text-white/48">Outstanding</span><strong className={gallery.unlocked ? "text-emerald-200" : "text-[#f1d59b]"}>{gallery.payment.balance}</strong></div>
            </div>
            <div className="mt-5 grid gap-2">
              <a href={gallery.payment.invoiceNumber ? "#" : `mailto:${gallery.business.email ?? ""}`} className="rounded-2xl bg-white px-4 py-3 text-center text-sm font-bold text-[#130b16] hover:brightness-95">
                {gallery.unlocked ? "Payment Complete" : "Pay Now"}
              </a>
              <a href={gallery.business.phone ? `tel:${gallery.business.phone}` : `mailto:${gallery.business.email ?? ""}`} className="rounded-2xl border border-white/15 px-4 py-3 text-center text-sm font-semibold text-white/78 hover:bg-white/10">
                Contact Business
              </a>
            </div>
          </aside>
        </section>

        <section className="flex flex-wrap items-center gap-2">
          <label className="flex h-11 min-w-60 flex-1 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-3 text-sm text-white/48">
            <Search size={15} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full bg-transparent text-white outline-none placeholder:text-white/35" placeholder="Search by image or category" />
          </label>
          {["All", ...gallery.categories].map((item) => (
            <button key={item} onClick={() => setCategory(item)} className={`h-11 rounded-2xl px-4 text-sm font-semibold ${category === item ? "bg-[#f1d59b] text-[#130b16]" : "border border-white/10 bg-white/[0.06] text-white/68 hover:bg-white/10"}`}>
              {item}
            </button>
          ))}
        </section>

        <section className="columns-1 gap-4 sm:columns-2 lg:columns-3">
          {filtered.map((media, index) => (
            <article key={media.id} className="mb-4 break-inside-avoid overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.06]">
              <button onClick={() => setSelected(index)} className="group relative block aspect-[4/3] w-full overflow-hidden text-left">
                {media.type === "VIDEO" ? (
                  <video src={media.url} className="size-full bg-black object-cover" controls={gallery.unlocked} controlsList="nodownload" onContextMenu={(event) => event.preventDefault()} />
                ) : (
                  <GalleryImage
                    media={media}
                    className="size-full bg-white/5 object-cover transition duration-500 group-hover:scale-[1.03]"
                    fallbackClassName="size-full"
                  />
                )}
                {!gallery.unlocked ? (
                  <span
                    className="pointer-events-none absolute whitespace-nowrap font-serif text-2xl font-semibold text-white"
                    style={{
                      opacity: media.watermarkStyle.opacity,
                      transform: `rotate(${media.watermarkStyle.rotate}deg)`,
                      top: media.watermarkStyle.top,
                      left: media.watermarkStyle.left,
                    }}
                  >
                    {media.watermark}
                  </span>
                ) : null}
                <span className="absolute right-3 top-3 grid size-10 place-items-center rounded-2xl bg-black/35 text-white opacity-0 backdrop-blur transition group-hover:opacity-100">
                  <Maximize2 size={16} />
                </span>
              </button>
              <div className="flex items-center gap-2 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{media.title}</div>
                  <div className="text-xs text-white/42">{media.category}</div>
                </div>
                <form action={favoriteGalleryMediaAction}>
                  <input type="hidden" name="token" value={gallery.token} />
                  <input type="hidden" name="mediaId" value={media.id} />
                  <button className={`grid size-10 place-items-center rounded-2xl ${media.favorite ? "bg-[#f1d59b] text-[#130b16]" : "border border-white/10 text-white/58 hover:bg-white/10"}`} aria-label="Favorite image">
                    <Heart size={16} fill={media.favorite ? "currentColor" : "none"} />
                  </button>
                </form>
              </div>
            </article>
          ))}
        </section>

        <section className="grid gap-4 rounded-[30px] border border-white/10 bg-white/[0.06] p-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><MessageCircle size={18} className="text-[#f1d59b]" /> Comments</h2>
          <form action={commentOnGalleryAction} className="grid gap-3">
            <input type="hidden" name="token" value={gallery.token} />
            <input type="hidden" name="mediaId" value={selectedMedia?.id ?? ""} />
            <div className="grid gap-3 sm:grid-cols-[220px_minmax(0,1fr)_120px]">
              <input name="author" className="rounded-2xl border border-white/10 bg-black/18 px-4 py-3 text-sm text-white outline-none" placeholder="Your name" />
              <input name="body" className="rounded-2xl border border-white/10 bg-black/18 px-4 py-3 text-sm text-white outline-none" placeholder={selectedMedia ? `Comment on ${selectedMedia.title}` : "Leave a gallery comment"} required />
              <button className="rounded-2xl bg-[#f1d59b] px-4 py-3 text-sm font-bold text-[#130b16]">Comment</button>
            </div>
          </form>
          <div className="grid gap-2">
            {gallery.comments.length === 0 ? <p className="text-sm text-white/45">No comments yet.</p> : gallery.comments.map((comment) => (
              <div key={comment.id} className="rounded-2xl border border-white/10 bg-black/12 px-4 py-3 text-sm">
                <div className="font-semibold">{comment.author} <span className="font-normal text-white/35">· {comment.when}</span></div>
                <p className="mt-1 text-white/65">{comment.body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      {selectedMedia ? (
        <div className="fixed inset-0 z-50 grid bg-black/92">
          <div className="absolute right-4 top-4 flex gap-2">
            <button className="grid size-11 place-items-center rounded-2xl bg-white/10 text-white" aria-label="Share">
              <Share2 size={18} />
            </button>
            <button onClick={() => setSelected(null)} className="grid size-11 place-items-center rounded-2xl bg-white/10 text-white" aria-label="Close">
              <X size={18} />
            </button>
          </div>
          <button onClick={() => setSelected((current) => current == null ? 0 : (current + filtered.length - 1) % filtered.length)} className="absolute left-4 top-1/2 rounded-full bg-white/10 px-4 py-3 text-white">Prev</button>
          <button onClick={() => setSelected((current) => current == null ? 0 : (current + 1) % filtered.length)} className="absolute right-4 top-1/2 rounded-full bg-white/10 px-4 py-3 text-white">Next</button>
          <div className="grid place-items-center p-4">
            <div className="relative max-h-[88vh] max-w-[92vw] overflow-hidden rounded-[24px]">
              {selectedMedia.type === "VIDEO" ? (
                <video src={selectedMedia.url} className="max-h-[88vh] max-w-[92vw]" controls controlsList="nodownload" onContextMenu={(event) => event.preventDefault()} />
              ) : (
                <GalleryImage
                  media={selectedMedia}
                  className="max-h-[88vh] max-w-[92vw] object-contain"
                  fallbackClassName="h-[min(64vh,620px)] w-[min(92vw,920px)]"
                />
              )}
              {!gallery.unlocked ? (
                <span className="pointer-events-none absolute left-[12%] top-[38%] -rotate-12 whitespace-nowrap font-serif text-5xl font-semibold text-white/20">
                  {selectedMedia.watermark}
                </span>
              ) : null}
            </div>
          </div>
          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-2xl bg-white/10 px-4 py-2 text-sm text-white/72 backdrop-blur">
            <ZoomIn size={15} /> Pinch or browser zoom to inspect quality
          </div>
        </div>
      ) : null}
    </div>
  );
}
