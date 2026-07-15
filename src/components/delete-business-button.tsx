"use client";

type DeleteBusinessButtonProps = {
  businessId: string;
  slug: string;
  action: (formData: FormData) => void | Promise<void>;
};

export function DeleteBusinessButton({ businessId, slug, action }: DeleteBusinessButtonProps) {
  return (
    <form action={action}>
      <input type="hidden" name="businessId" value={businessId} />
      <button
        type="submit"
        onClick={(e) => {
          const typed = window.prompt(
            `Permanently delete "${slug}" and ALL its data (staff, clients, appointments, inventory — everything)?\n\nThis cannot be undone. Type the slug "${slug}" to confirm:`,
          );
          if (typed !== slug) {
            e.preventDefault();
          }
        }}
        className="rounded-xl border border-[#e6c6cd] bg-white px-3 py-2 text-xs font-semibold text-rose-700"
      >
        Delete
      </button>
    </form>
  );
}
