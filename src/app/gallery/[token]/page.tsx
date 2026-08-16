import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { ClientGalleryViewer } from "@/components/client-gallery-viewer";
import { getPublicGallery } from "@/lib/gallery-data";

export const dynamic = "force-dynamic";

type PublicGalleryPageProps = {
  params: Promise<{ token: string }>;
};

export default async function PublicGalleryPage({ params }: PublicGalleryPageProps) {
  const { token } = await params;
  const sessionId = (await cookies()).get("beauty_gallery_session")?.value ?? "anonymous";
  const gallery = await getPublicGallery(token, sessionId);
  if (!gallery) notFound();

  if (gallery.expired || gallery.revoked) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#130b16] px-4 text-white">
        <section className="max-w-md rounded-[30px] border border-white/10 bg-white/[0.06] p-7 text-center shadow-2xl">
          <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#f1d59b]/15 text-[#f1d59b]">G</div>
          <h1 className="mt-5 font-serif text-3xl font-semibold">{gallery.revoked ? "Gallery access unavailable" : "This gallery has expired"}</h1>
          <p className="mt-3 text-sm leading-6 text-white/58">
            Please contact {gallery.business.name} for continued access.
          </p>
        </section>
      </main>
    );
  }

  return <ClientGalleryViewer gallery={gallery} />;
}
