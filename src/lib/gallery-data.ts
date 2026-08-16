import "server-only";

import { createHash, randomBytes } from "crypto";
import { headers } from "next/headers";
import { prisma, isDatabaseConfigured } from "@/lib/prisma";
import { collected, outstanding, bookingPaymentsWhere, refundWhere } from "@/lib/money";
import { withBypass } from "@/lib/tenant-context";
import { uploadGalleryDataUrlToR2 } from "@/lib/r2-storage";

export type GalleryStatus =
  | "DRAFT"
  | "EDITING"
  | "READY_FOR_REVIEW"
  | "AWAITING_PAYMENT"
  | "PAID"
  | "COMPLETED"
  | "ARCHIVED";

type GalleryWriteResult = { ok: true; id?: string; link?: string } | { ok: false; error: string };

const STATUS_LABEL: Record<GalleryStatus, string> = {
  DRAFT: "Draft",
  EDITING: "Editing",
  READY_FOR_REVIEW: "Ready for Review",
  AWAITING_PAYMENT: "Awaiting Payment",
  PAID: "Paid",
  COMPLETED: "Completed",
  ARCHIVED: "Archived",
};

const EXPIRY_DAYS: Record<string, number | null> = {
  never: null,
  "3": 3,
  "7": 7,
  "14": 14,
  "30": 30,
};

function token() {
  return randomBytes(24).toString("base64url");
}

function hashToken(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function currencySymbol(currency: string) {
  return currency === "GHS" ? "GH₵" : currency;
}

function money(amount: number, currency: string) {
  return `${currencySymbol(currency)} ${Math.round(amount).toLocaleString("en-US")}`;
}

function clientName(customer: { firstName: string; lastName: string | null } | null | undefined) {
  if (!customer) return "Client";
  return [customer.firstName, customer.lastName].filter(Boolean).join(" ");
}

function shortDate(date: Date | null | undefined) {
  if (!date) return "-";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

function expiryFrom(value: string, customDate?: Date | null) {
  if (value === "custom") return customDate ?? null;
  const days = EXPIRY_DAYS[value] ?? null;
  if (days == null) return null;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function normalizeGalleryMediaUrl(value: string) {
  const raw = value.trim();
  if (/^data:image\//i.test(raw)) return raw;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  if (url.hostname === "drive.google.com") {
    if (url.pathname.startsWith("/drive/folders/")) return null;
    const fileId = url.pathname.match(/\/file\/d\/([^/]+)/)?.[1] ?? url.searchParams.get("id");
    if (fileId) return `https://drive.google.com/uc?export=view&id=${encodeURIComponent(fileId)}`;
  }

  if (url.hostname.endsWith("dropbox.com")) {
    url.searchParams.delete("dl");
    url.searchParams.set("raw", "1");
  }

  return url.toString();
}

function isDataImageUrl(value: string) {
  return /^data:image\//i.test(value);
}

async function materializeGalleryMediaUrl(value: string, businessId: string) {
  if (!isDataImageUrl(value)) return value;
  const uploaded = await uploadGalleryDataUrlToR2({
    dataUrl: value,
    keyPrefix: `galleries/${businessId}`,
  });
  return uploaded?.url ?? value;
}

function publicBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || process.env.PUBLIC_URL?.replace(/\/$/, "") || "https://beauty-os-six.vercel.app";
}

async function requestMeta() {
  const h = await headers();
  const userAgent = h.get("user-agent") ?? "";
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  const ua = userAgent.toLowerCase();
  const browser = ua.includes("chrome") ? "Chrome" : ua.includes("safari") ? "Safari" : ua.includes("firefox") ? "Firefox" : ua ? "Other" : null;
  const device = /mobile|iphone|android/.test(ua) ? "Mobile" : /ipad|tablet/.test(ua) ? "Tablet" : ua ? "Desktop" : null;
  return { ipAddress: ip, userAgent, browser, device };
}

async function recordEvent(input: {
  businessId: string;
  galleryId: string;
  type: "SENT" | "OPENED" | "VIEWED_IMAGE" | "FAVORITED" | "COMMENTED" | "PAYMENT_PENDING" | "PAYMENT_RECEIVED" | "DOWNLOAD_ENABLED" | "COMPLETED" | "REVOKED";
  mediaId?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}) {
  if (!isDatabaseConfigured()) return;
  const meta = await requestMeta().catch(() => ({ ipAddress: null, userAgent: "", browser: null, device: null }));
  await withBypass(() => prisma.galleryAccessEvent.create({
    data: {
      businessId: input.businessId,
      galleryId: input.galleryId,
      mediaId: input.mediaId,
      type: input.type,
      sessionId: input.sessionId,
      metadata: input.metadata as never,
      ...meta,
    },
  })).catch(() => {});
}

async function paymentSnapshot(input: { businessId: string; appointmentId?: string | null; invoiceId?: string | null; fallbackTotal: number }) {
  if (input.invoiceId) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: input.invoiceId, businessId: input.businessId },
      select: { total: true, payments: { select: { amount: true, type: true, status: true } } },
    });
    if (invoice) {
      let paid = 0;
      let refunded = 0;
      for (const payment of invoice.payments) {
        if (payment.status !== "SUCCESS") continue;
        if (payment.type === "REFUND") refunded += Number(payment.amount);
        else paid += Number(payment.amount);
      }
      const net = collected(paid, refunded);
      const total = Number(invoice.total);
      return { total, paid: net, balance: outstanding(total, net) };
    }
  }

  const total = input.fallbackTotal;
  const [paidAgg, refundAgg] = await Promise.all([
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: { ...bookingPaymentsWhere(input.businessId), appointmentId: input.appointmentId ?? undefined },
    }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: { ...refundWhere(input.businessId), appointmentId: input.appointmentId ?? undefined },
    }),
  ]);
  const paid = collected(Number(paidAgg._sum.amount ?? 0), Number(refundAgg._sum.amount ?? 0));
  return { total, paid, balance: outstanding(total, paid) };
}

export async function getGalleryModuleData(businessSlug: string) {
  if (!isDatabaseConfigured()) return null;
  const business = await prisma.business.findUnique({
    where: { slug: businessSlug },
    select: { id: true, name: true, slug: true, currency: true },
  });
  if (!business) return null;

  const [galleries, appointments, invoices] = await Promise.all([
    prisma.clientGallery.findMany({
      where: { businessId: business.id },
      orderBy: { updatedAt: "desc" },
      include: {
        customer: { select: { firstName: true, lastName: true } },
        appointment: { select: { startAt: true, service: { select: { name: true } }, staffMember: { select: { invitedEmail: true, user: { select: { name: true } } } } } },
        invoice: { select: { invoiceNumber: true, status: true } },
        media: {
          orderBy: { sortOrder: "asc" },
          select: { id: true, type: true, url: true, thumbnailUrl: true, title: true },
          take: 100,
        },
        comments: { select: { id: true } },
        favorites: { select: { id: true } },
        events: { orderBy: { createdAt: "desc" }, take: 50 },
      },
    }),
    prisma.appointment.findMany({
      where: { businessId: business.id, status: { in: ["CONFIRMED", "COMPLETED"] } },
      orderBy: { startAt: "desc" },
      take: 100,
      select: {
        id: true,
        startAt: true,
        price: true,
        customer: { select: { firstName: true, lastName: true } },
        service: { select: { name: true } },
      },
    }),
    prisma.invoice.findMany({
      where: { businessId: business.id, status: { not: "VOID" } },
      orderBy: { issuedAt: "desc" },
      take: 100,
      select: { id: true, invoiceNumber: true, total: true, customer: { select: { firstName: true, lastName: true } } },
    }),
  ]);

  return {
    tenant: business,
    stats: [
      { label: "Galleries", value: galleries.length, detail: "Secure client galleries" },
      { label: "Awaiting payment", value: galleries.filter((g) => g.status === "AWAITING_PAYMENT").length, detail: "Payment pending" },
      { label: "Unlocked", value: galleries.filter((g) => g.downloadsEnabled).length, detail: "Payment confirmed" },
      { label: "Comments", value: galleries.reduce((sum, g) => sum + g.comments.length, 0), detail: "Client feedback" },
    ],
    galleries: galleries.map((gallery) => {
      const firstOpen = gallery.events.filter((e) => e.type === "OPENED").at(-1)?.createdAt ?? null;
      const lastOpen = gallery.events.find((e) => e.type === "OPENED")?.createdAt ?? null;
      const visits = gallery.events.filter((e) => e.type === "OPENED").length;
      const link = `${publicBaseUrl()}/gallery/${gallery.shareSlug}`;
      return {
        id: gallery.id,
        title: gallery.title,
        client: clientName(gallery.customer),
        status: STATUS_LABEL[gallery.status as GalleryStatus],
        statusKey: gallery.status,
        date: shortDate(gallery.appointment?.startAt ?? gallery.createdAt),
        artist: gallery.appointment?.staffMember?.user?.name ?? gallery.appointment?.staffMember?.invitedEmail ?? "Unassigned",
        mediaCount: gallery.media.length,
        previewMedia: gallery.media.slice(0, 4).map((media, index) => ({
          id: media.id,
          type: media.type,
          url: media.thumbnailUrl || media.url,
          title: media.title || `Preview ${index + 1}`,
        })),
        favorites: gallery.favorites.length,
        comments: gallery.comments.length,
        visits,
        firstOpen: shortDate(firstOpen),
        lastOpen: shortDate(lastOpen),
        balance: money(Number(gallery.outstandingBalance), business.currency),
        downloadsEnabled: gallery.downloadsEnabled,
        expired: gallery.expiresAt != null && gallery.expiresAt < new Date(),
        revoked: gallery.revokedAt != null,
        link,
      };
    }),
    appointments: appointments.map((appointment) => ({
      id: appointment.id,
      label: `${clientName(appointment.customer)} - ${appointment.service.name} (${shortDate(appointment.startAt)})`,
      price: Number(appointment.price),
    })),
    invoices: invoices.map((invoice) => ({
      id: invoice.id,
      label: `${invoice.invoiceNumber} - ${clientName(invoice.customer)}`,
      total: Number(invoice.total),
    })),
  };
}

export async function createGallery(input: {
  businessSlug: string;
  appointmentId: string;
  invoiceId?: string;
  title: string;
  expiry: string;
  customExpiry?: Date | null;
  mediaUrls: string;
}): Promise<GalleryWriteResult> {
  if (!isDatabaseConfigured()) return { ok: false, error: "Database is not configured." };
  const business = await prisma.business.findUnique({ where: { slug: input.businessSlug }, select: { id: true, currency: true } });
  if (!business) return { ok: false, error: "Workspace not found." };

  const appointment = await prisma.appointment.findFirst({
    where: { id: input.appointmentId, businessId: business.id },
    select: { id: true, customerId: true, startAt: true, price: true, service: { select: { name: true } } },
  });
  if (!appointment) return { ok: false, error: "Choose a valid booking/project." };

  const snapshot = await paymentSnapshot({
    businessId: business.id,
    appointmentId: appointment.id,
    invoiceId: input.invoiceId || null,
    fallbackTotal: Number(appointment.price),
  });
  const raw = token();
  const entries = input.mediaUrls.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 80);
  const invalidEntries = entries.filter((entry) => !normalizeGalleryMediaUrl(entry));
  if (invalidEntries.length > 0) {
    const firstInvalid = invalidEntries[0];
    const isDriveFolder = /^https:\/\/drive\.google\.com\/drive\/folders\//i.test(firstInvalid);
    return {
      ok: false,
      error: isDriveFolder
        ? "Google Drive folder links cannot be previewed as images. Paste one share link per image or video instead."
        : `Use direct http(s) image/video URLs only. Invalid entry: ${firstInvalid.slice(0, 80)}`,
    };
  }
  const normalizedUrls = entries.map((entry) => normalizeGalleryMediaUrl(entry)).filter((url): url is string => Boolean(url));
  const urls = await Promise.all(normalizedUrls.map((url) => materializeGalleryMediaUrl(url, business.id))).catch(() => null);
  if (!urls) return { ok: false, error: "Could not upload gallery media to Cloudflare R2. Check storage settings and try again." };
  if (urls.length === 0) return { ok: false, error: "Add at least one hosted image or video URL." };
  const title = input.title.trim() || `${appointment.service.name} gallery`;

  const gallery = await prisma.clientGallery.create({
    data: {
      businessId: business.id,
      customerId: appointment.customerId,
      appointmentId: appointment.id,
      invoiceId: input.invoiceId || null,
      title,
      status: "READY_FOR_REVIEW",
      tokenHash: hashToken(raw),
      shareSlug: raw,
      expiresAt: expiryFrom(input.expiry, input.customExpiry),
      projectTotal: snapshot.total,
      depositPaid: snapshot.paid,
      outstandingBalance: snapshot.balance,
      downloadsEnabled: snapshot.balance <= 0,
      originalsEnabled: snapshot.balance <= 0,
      zipEnabled: snapshot.balance <= 0,
      sharingEnabled: snapshot.balance <= 0,
      printEnabled: snapshot.balance <= 0,
      media: {
        create: urls.map((url, index) => ({
          url,
          originalUrl: url,
          type: /\.(mp4|mov|webm)(\?|$)/i.test(url) ? "VIDEO" : "IMAGE",
          title: `Selection ${index + 1}`,
          category: index % 3 === 0 ? "Highlights" : index % 3 === 1 ? "Details" : "Finals",
          sortOrder: index,
        })),
      },
    },
    select: { id: true },
  });

  return { ok: true, id: gallery.id, link: `${publicBaseUrl()}/gallery/${raw}` };
}

export async function sendGallery(businessSlug: string, galleryId: string): Promise<GalleryWriteResult> {
  const gallery = await prisma.clientGallery.findFirst({ where: { id: galleryId, business: { slug: businessSlug } }, select: { id: true, businessId: true, status: true, shareSlug: true } });
  if (!gallery) return { ok: false, error: "Gallery not found." };
  if (gallery.status !== "READY_FOR_REVIEW" && gallery.status !== "AWAITING_PAYMENT") {
    return { ok: false, error: "Only galleries in Ready for Review or Awaiting Payment can be sent." };
  }
  if (gallery.status === "AWAITING_PAYMENT") {
    return { ok: true, link: `${publicBaseUrl()}/gallery/${gallery.shareSlug}` };
  }
  await prisma.clientGallery.update({
    where: { id: gallery.id },
    data: { status: "AWAITING_PAYMENT", sentAt: new Date() },
  });
  await recordEvent({ businessId: gallery.businessId, galleryId: gallery.id, type: "SENT" });
  await recordEvent({ businessId: gallery.businessId, galleryId: gallery.id, type: "PAYMENT_PENDING" });
  return { ok: true, link: `${publicBaseUrl()}/gallery/${gallery.shareSlug}` };
}

export async function unlockGallery(businessSlug: string, galleryId: string): Promise<GalleryWriteResult> {
  const gallery = await prisma.clientGallery.findFirst({ where: { id: galleryId, business: { slug: businessSlug } }, select: { id: true, businessId: true } });
  if (!gallery) return { ok: false, error: "Gallery not found." };
  await prisma.clientGallery.update({
    where: { id: gallery.id },
    data: {
      status: "PAID",
      downloadsEnabled: true,
      originalsEnabled: true,
      zipEnabled: true,
      sharingEnabled: true,
      printEnabled: true,
      outstandingBalance: 0,
    },
  });
  await recordEvent({ businessId: gallery.businessId, galleryId: gallery.id, type: "PAYMENT_RECEIVED" });
  await recordEvent({ businessId: gallery.businessId, galleryId: gallery.id, type: "DOWNLOAD_ENABLED" });
  return { ok: true };
}

export async function completeGallery(businessSlug: string, galleryId: string): Promise<GalleryWriteResult> {
  const gallery = await prisma.clientGallery.findFirst({ where: { id: galleryId, business: { slug: businessSlug } }, select: { id: true, businessId: true } });
  if (!gallery) return { ok: false, error: "Gallery not found." };
  await prisma.clientGallery.update({ where: { id: gallery.id }, data: { status: "COMPLETED", completedAt: new Date() } });
  await recordEvent({ businessId: gallery.businessId, galleryId: gallery.id, type: "COMPLETED" });
  return { ok: true };
}

export async function revokeGallery(businessSlug: string, galleryId: string): Promise<GalleryWriteResult> {
  const gallery = await prisma.clientGallery.findFirst({ where: { id: galleryId, business: { slug: businessSlug } }, select: { id: true, businessId: true } });
  if (!gallery) return { ok: false, error: "Gallery not found." };
  await prisma.clientGallery.update({ where: { id: gallery.id }, data: { revokedAt: new Date() } });
  await recordEvent({ businessId: gallery.businessId, galleryId: gallery.id, type: "REVOKED" });
  return { ok: true };
}

export async function deleteGallery(businessSlug: string, galleryId: string): Promise<GalleryWriteResult> {
  const gallery = await prisma.clientGallery.findFirst({
    where: { id: galleryId, business: { slug: businessSlug } },
    select: { id: true },
  });
  if (!gallery) return { ok: false, error: "Gallery not found." };
  await prisma.clientGallery.delete({ where: { id: gallery.id } });
  return { ok: true };
}

export async function getPublicGallery(rawToken: string, sessionId: string) {
  return withBypass(() => getPublicGalleryBypass(rawToken, sessionId));
}

async function getPublicGalleryBypass(rawToken: string, sessionId: string) {
  if (!isDatabaseConfigured()) return null;
  const gallery = await prisma.clientGallery.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    include: {
      business: { select: { id: true, name: true, logoUrl: true, phone: true, email: true, currency: true } },
      appointment: { select: { startAt: true, service: { select: { name: true } }, staffMember: { select: { invitedEmail: true, user: { select: { name: true } } } } } },
      invoice: { select: { id: true, invoiceNumber: true, status: true } },
      media: { orderBy: { sortOrder: "asc" } },
      comments: { orderBy: { createdAt: "desc" }, take: 100 },
      favorites: { where: { sessionId }, select: { mediaId: true } },
    },
  });
  if (!gallery) return null;

  const expired = gallery.expiresAt != null && gallery.expiresAt < new Date();
  const revoked = gallery.revokedAt != null;
  if (!expired && !revoked) {
    await recordEvent({ businessId: gallery.businessId, galleryId: gallery.id, type: "OPENED", sessionId });
  }
  const unlocked = gallery.downloadsEnabled && Number(gallery.outstandingBalance) <= 0;
  const favoriteSet = new Set(gallery.favorites.map((f) => f.mediaId));
  const customer = await prisma.customer.findUnique({
    where: { id: gallery.customerId },
    select: { firstName: true, lastName: true },
  });
  const client = clientName(customer);

  return {
    id: gallery.id,
    token: rawToken,
    title: gallery.title,
    business: gallery.business,
    client,
    status: STATUS_LABEL[gallery.status as GalleryStatus],
    appointmentDate: shortDate(gallery.appointment?.startAt),
    artist: gallery.appointment?.staffMember?.user?.name ?? gallery.appointment?.staffMember?.invitedEmail ?? "Your artist",
    service: gallery.appointment?.service.name ?? "Project",
    expired,
    revoked,
    unlocked,
    canDownload: false,
    payment: {
      projectTotal: money(Number(gallery.projectTotal), gallery.business.currency),
      depositPaid: money(Number(gallery.depositPaid), gallery.business.currency),
      balance: money(Number(gallery.outstandingBalance), gallery.business.currency),
      status: unlocked ? "Payment complete" : "Awaiting payment",
      invoiceId: gallery.invoice?.id ?? null,
      invoiceNumber: gallery.invoice?.invoiceNumber ?? null,
    },
    media: gallery.media.map((media, index) => ({
      id: media.id,
      type: media.type,
      url: unlocked ? media.originalUrl || media.url : media.thumbnailUrl || media.url,
      originalUrl: media.originalUrl || media.url,
      title: media.title || `Image ${index + 1}`,
      category: media.category || "Gallery",
      favorite: favoriteSet.has(media.id),
      watermark: `Preview Only | ${gallery.business.name} | ${client} | ${gallery.shareSlug.slice(0, 8)} | ${shortDate(gallery.appointment?.startAt)}`,
      watermarkStyle: {
        opacity: 0.13 + (index % 4) * 0.045,
        rotate: index % 2 === 0 ? -18 : 18,
        top: `${18 + (index % 5) * 13}%`,
        left: `${8 + (index % 4) * 17}%`,
      },
    })),
    comments: gallery.comments.map((comment) => ({
      id: comment.id,
      mediaId: comment.mediaId,
      author: comment.author || "Client",
      body: comment.body,
      when: shortDate(comment.createdAt),
    })),
    categories: [...new Set(gallery.media.map((m) => m.category || "Gallery"))],
  };
}

export async function favoriteGalleryMedia(rawToken: string, mediaId: string, sessionId: string): Promise<GalleryWriteResult> {
  return withBypass(() => favoriteGalleryMediaBypass(rawToken, mediaId, sessionId));
}

async function favoriteGalleryMediaBypass(rawToken: string, mediaId: string, sessionId: string): Promise<GalleryWriteResult> {
  const gallery = await prisma.clientGallery.findUnique({ where: { tokenHash: hashToken(rawToken) }, select: { id: true, businessId: true, revokedAt: true, expiresAt: true } });
  if (!gallery || gallery.revokedAt || (gallery.expiresAt && gallery.expiresAt < new Date())) return { ok: false, error: "Gallery access is no longer available." };
  const existing = await prisma.galleryFavorite.findUnique({ where: { mediaId_sessionId: { mediaId, sessionId } }, select: { id: true } });
  if (existing) {
    await prisma.galleryFavorite.delete({ where: { id: existing.id } });
  } else {
    await prisma.galleryFavorite.create({ data: { galleryId: gallery.id, mediaId, sessionId } });
    await recordEvent({ businessId: gallery.businessId, galleryId: gallery.id, mediaId, sessionId, type: "FAVORITED" });
  }
  return { ok: true };
}

export async function recordGalleryMediaView(rawToken: string, mediaId: string, sessionId: string): Promise<GalleryWriteResult> {
  return withBypass(() => recordGalleryMediaViewBypass(rawToken, mediaId, sessionId));
}

async function recordGalleryMediaViewBypass(rawToken: string, mediaId: string, sessionId: string): Promise<GalleryWriteResult> {
  const gallery = await prisma.clientGallery.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    select: { id: true, businessId: true, revokedAt: true, expiresAt: true, media: { where: { id: mediaId }, select: { id: true }, take: 1 } },
  });
  if (!gallery || gallery.revokedAt || (gallery.expiresAt && gallery.expiresAt < new Date()) || gallery.media.length === 0) {
    return { ok: false, error: "Gallery access is no longer available." };
  }
  await recordEvent({ businessId: gallery.businessId, galleryId: gallery.id, mediaId, sessionId, type: "VIEWED_IMAGE" });
  return { ok: true };
}

export async function commentOnGallery(rawToken: string, mediaId: string | null, body: string, author: string, sessionId: string): Promise<GalleryWriteResult> {
  return withBypass(() => commentOnGalleryBypass(rawToken, mediaId, body, author, sessionId));
}

async function commentOnGalleryBypass(rawToken: string, mediaId: string | null, body: string, author: string, sessionId: string): Promise<GalleryWriteResult> {
  const gallery = await prisma.clientGallery.findUnique({ where: { tokenHash: hashToken(rawToken) }, select: { id: true, businessId: true, revokedAt: true, expiresAt: true } });
  if (!gallery || gallery.revokedAt || (gallery.expiresAt && gallery.expiresAt < new Date())) return { ok: false, error: "Gallery access is no longer available." };
  const clean = body.trim();
  if (!clean) return { ok: false, error: "Comment cannot be empty." };
  await prisma.galleryComment.create({ data: { galleryId: gallery.id, mediaId: mediaId || null, body: clean.slice(0, 1000), author: author.trim().slice(0, 80) || "Client", sessionId } });
  await recordEvent({ businessId: gallery.businessId, galleryId: gallery.id, mediaId: mediaId || undefined, sessionId, type: "COMMENTED" });
  return { ok: true };
}
