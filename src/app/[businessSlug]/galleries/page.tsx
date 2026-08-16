import Link from "next/link";
import { notFound } from "next/navigation";
import { Copy, ExternalLink, Film, Images, Lock, Mail, MessageCircle, Send, ShieldCheck, Sparkles, Trash2, Unlock } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge, EmptyState, StatTile, statMetaFor, toneForStatus } from "@/components/ui";
import { GalleryMediaInput } from "@/components/gallery-media-input";
import { getGalleryModuleData } from "@/lib/gallery-data";
import { requireTenantAccess } from "@/lib/auth";
import { membershipIn, roleCan } from "@/lib/permissions";
import {
  completeGalleryAction,
  createGalleryAction,
  deleteGalleryAction,
  revokeGalleryAction,
  sendGalleryAction,
  unlockGalleryAction,
} from "@/lib/gallery-actions";

export const dynamic = "force-dynamic";

type GalleriesPageProps = {
  params: Promise<{ businessSlug: string }>;
  searchParams: Promise<{ new?: string }>;
};

function messageFor(link: string) {
  return `Your gallery is ready for viewing. Click the link below to preview your images.\n\n${link}`;
}

export default async function GalleriesPage({ params, searchParams }: GalleriesPageProps) {
  const { businessSlug } = await params;
  const { new: newParam } = await searchParams;
  const user = await requireTenantAccess(businessSlug);
  const membership = await membershipIn(user, businessSlug);
  const canEdit = roleCan(membership?.role, "galleries:edit");
  const canUnlock = roleCan(membership?.role, "galleries:unlock");
  const canComplete = roleCan(membership?.role, "galleries:complete");
  const canDelete = roleCan(membership?.role, "galleries:delete");
  const data = await getGalleryModuleData(businessSlug);
  if (!data) notFound();
  const showNew = newParam === "1";

  return (
    <div className="grid gap-5">
      <PageHeader title="Galleries" description="Secure client galleries with private preview links and dynamic preview watermarks.">
        <Link href={`/${businessSlug}/galleries?new=1#create-gallery`} className="primary-action inline-flex items-center gap-1.5 rounded-2xl px-4 py-2.5 text-sm font-semibold text-white">
          <Images size={16} /> New gallery
        </Link>
      </PageHeader>

      <section className="grid grid-cols-4 gap-4 max-[1080px]:grid-cols-2 max-[640px]:grid-cols-1">
        {data.stats.map((stat) => {
          const meta = statMetaFor(stat.label);
          return <StatTile key={stat.label} label={stat.label} value={stat.value} detail={stat.detail} icon={meta.icon} tone={meta.tone} />;
        })}
      </section>

      <section className="brand-dark relative overflow-hidden rounded-[var(--radius-card)] p-6 text-white shadow-[var(--shadow-lift)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_0%,rgba(236,206,154,0.22),transparent_18rem)]" />
        <div className="relative grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-rose">
              <ShieldCheck size={13} /> Preview protected
            </div>
            <h2 className="mt-4 font-serif text-3xl font-semibold tracking-tight">Deliver work before releasing the originals.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/68">
              Clients can preview, zoom, favorite and comment. Downloads, ZIP export and original resolution are not exposed on the shared client link.
            </p>
          </div>
          <div className="rounded-[26px] border border-white/15 bg-white/[0.08] p-4">
            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/45">Protection note</div>
            <p className="mt-2 text-sm leading-6 text-white/70">
              The gallery uses access tokens, expiry, revocation and dynamic watermarks. Screenshot prevention is not promised because browsers cannot guarantee it.
            </p>
          </div>
        </div>
      </section>

      {canEdit ? (
        <details id="create-gallery" open={showNew} className="group card overflow-hidden p-0">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 [&::-webkit-details-marker]:hidden">
            <div>
              <h2 className="text-lg font-semibold">Create secure gallery</h2>
              <p className="mt-1 text-sm text-muted">Choose a booking/project, paste hosted image or video URLs, then send the protected link.</p>
            </div>
            <Sparkles size={18} className="text-plum" />
          </summary>
          <form action={createGalleryAction} className="grid gap-4 border-t border-line-2 p-5">
            <input type="hidden" name="businessSlug" value={businessSlug} />
            <div className="grid gap-4 md:grid-cols-2">
              <label className="field-label">
                Booking / project
                <select name="appointmentId" className="input" required>
                  <option value="">Choose booking</option>
                  {data.appointments.map((appointment) => (
                    <option key={appointment.id} value={appointment.id}>{appointment.label}</option>
                  ))}
                </select>
              </label>
              <label className="field-label">
                Linked invoice
                <select name="invoiceId" className="input">
                  <option value="">No invoice linked</option>
                  {data.invoices.map((invoice) => (
                    <option key={invoice.id} value={invoice.id}>{invoice.label}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="field-label">
              Gallery title
              <input name="title" className="input" placeholder="e.g. Mensah Wedding Highlights" />
            </label>
            <div className="grid gap-4 md:grid-cols-[1fr_220px]">
              <label className="field-label">
                Expiry
                <select name="expiry" className="input" defaultValue="14">
                  <option value="never">Never expires</option>
                  <option value="3">3 days</option>
                  <option value="7">7 days</option>
                  <option value="14">14 days</option>
                  <option value="30">30 days</option>
                  <option value="custom">Custom date</option>
                </select>
              </label>
              <label className="field-label">
                Custom expiry
                <input name="customExpiry" type="date" className="input" />
              </label>
            </div>
            <GalleryMediaInput />
            <button className="primary-action rounded-2xl px-4 py-3 text-sm font-semibold text-white">Create gallery</button>
          </form>
        </details>
      ) : null}

      <section className="grid gap-4">
        {data.galleries.length === 0 ? (
          <EmptyState icon={Images} title="No galleries yet" body="Create your first secure gallery from a booking or completed creative project." />
        ) : (
          data.galleries.map((gallery) => {
            const msg = encodeURIComponent(messageFor(gallery.link));
            return (
              <article key={gallery.id} className="card overflow-hidden p-0">
                <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_360px]">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={toneForStatus(gallery.status)}>{gallery.status}</Badge>
                      {gallery.downloadsEnabled ? <Badge tone="success">Payment confirmed</Badge> : <Badge tone="warning">Payment pending</Badge>}
                      {gallery.expired ? <Badge tone="danger">Expired</Badge> : null}
                      {gallery.revoked ? <Badge tone="danger">Revoked</Badge> : null}
                    </div>
                    <h2 className="mt-3 truncate font-serif text-2xl font-semibold tracking-tight">{gallery.title}</h2>
                    <p className="mt-1 text-sm text-muted">{gallery.client} · {gallery.date} · {gallery.artist}</p>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-5">
                      <div><div className="font-semibold text-ink">{gallery.mediaCount}</div><div className="text-xs text-muted">Media</div></div>
                      <div><div className="font-semibold text-ink">{gallery.favorites}</div><div className="text-xs text-muted">Favorites</div></div>
                      <div><div className="font-semibold text-ink">{gallery.comments}</div><div className="text-xs text-muted">Comments</div></div>
                      <div><div className="font-semibold text-ink">{gallery.visits}</div><div className="text-xs text-muted">Visits</div></div>
                      <div><div className="font-semibold text-ink">{gallery.balance}</div><div className="text-xs text-muted">Balance</div></div>
                    </div>
                    <div className="mt-4 rounded-2xl border border-line bg-sunken px-3 py-2 text-xs font-semibold text-muted">
                      <span className="mr-2 inline-flex items-center gap-1 text-ink"><Copy size={13} /> Secure link</span>
                      <span className="break-all">{gallery.link}</span>
                    </div>
                    <div className="mt-4">
                      {gallery.previewMedia.length > 0 ? (
                        <div className="grid grid-cols-4 gap-2">
                          {gallery.previewMedia.map((media) => (
                            <a
                              key={media.id}
                              href={gallery.link}
                              target="_blank"
                              rel="noreferrer"
                              className="group relative aspect-[4/3] overflow-hidden rounded-2xl border border-line bg-sunken"
                              aria-label={`Open ${gallery.title} preview`}
                            >
                              {media.type === "VIDEO" ? (
                                <>
                                  <video src={media.url} className="size-full object-cover" muted playsInline preload="metadata" />
                                  <span className="absolute inset-0 grid place-items-center bg-black/22 text-white">
                                    <Film size={18} />
                                  </span>
                                </>
                              ) : (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={media.url} alt={media.title} className="size-full object-cover transition duration-300 group-hover:scale-[1.04]" />
                              )}
                              <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/18 to-transparent opacity-0 transition group-hover:opacity-100" />
                            </a>
                          ))}
                        </div>
                      ) : (
                        <div className="grid min-h-24 place-items-center rounded-2xl border border-dashed border-line bg-sunken px-4 py-3 text-center text-xs font-semibold text-muted">
                          No media preview yet. Edit or recreate this gallery with hosted image or video URLs.
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="grid content-start gap-2">
                    <div className="grid grid-cols-2 gap-2">
                      <a href={gallery.link} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-line px-3 py-2 text-[12.5px] font-semibold text-ink hover:bg-sunken">
                        <ExternalLink size={14} /> Open
                      </a>
                      <a href={`mailto:?subject=${encodeURIComponent(`${gallery.title} is ready`)}&body=${msg}`} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-line px-3 py-2 text-[12.5px] font-semibold text-ink hover:bg-sunken">
                        <Mail size={14} /> Email
                      </a>
                      <a href={`https://wa.me/?text=${msg}`} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-line px-3 py-2 text-[12.5px] font-semibold text-ink hover:bg-sunken">
                        <MessageCircle size={14} /> WhatsApp
                      </a>
                      <a href={`sms:?&body=${msg}`} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-line px-3 py-2 text-[12.5px] font-semibold text-ink hover:bg-sunken">
                        <MessageCircle size={14} /> SMS
                      </a>
                    </div>
                    <form action={sendGalleryAction}>
                      <input type="hidden" name="businessSlug" value={businessSlug} />
                      <input type="hidden" name="galleryId" value={gallery.id} />
                      <button className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-plum px-3 py-2 text-[12.5px] font-semibold text-white hover:brightness-105">
                        <Send size={14} /> {gallery.statusKey === "AWAITING_PAYMENT" ? "Already marked sent" : "Mark as sent"}
                      </button>
                    </form>
                    {canUnlock ? (
                      <form action={unlockGalleryAction}>
                        <input type="hidden" name="businessSlug" value={businessSlug} />
                        <input type="hidden" name="galleryId" value={gallery.id} />
                        <input type="hidden" name="returnTo" value={`/${businessSlug}/galleries`} />
                        <button className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-success/25 bg-success-soft px-3 py-2 text-[12.5px] font-semibold text-success hover:bg-success hover:text-white">
                          <Unlock size={14} /> Manual payment unlock
                        </button>
                      </form>
                    ) : null}
                    {canComplete ? (
                      <form action={completeGalleryAction}>
                        <input type="hidden" name="businessSlug" value={businessSlug} />
                        <input type="hidden" name="galleryId" value={gallery.id} />
                        <button className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-line px-3 py-2 text-[12.5px] font-semibold text-ink hover:bg-sunken">
                          <ShieldCheck size={14} /> Complete Project
                        </button>
                      </form>
                    ) : null}
                    {canUnlock ? (
                      <form action={revokeGalleryAction}>
                        <input type="hidden" name="businessSlug" value={businessSlug} />
                        <input type="hidden" name="galleryId" value={gallery.id} />
                        <button className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-danger/25 bg-danger-soft px-3 py-2 text-[12.5px] font-semibold text-danger hover:bg-danger hover:text-white">
                          <Lock size={14} /> Revoke access
                        </button>
                      </form>
                    ) : null}
                    {canDelete ? (
                      <form
                        action={deleteGalleryAction}
                        data-confirm-title="Delete gallery permanently?"
                        data-confirm-body="This permanently removes the gallery, media records, favorites, comments, and analytics. This cannot be undone."
                      >
                        <input type="hidden" name="businessSlug" value={businessSlug} />
                        <input type="hidden" name="galleryId" value={gallery.id} />
                        <button className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-danger/25 px-3 py-2 text-[12.5px] font-semibold text-danger hover:bg-danger hover:text-white">
                          <Trash2 size={14} /> Delete permanently
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}
