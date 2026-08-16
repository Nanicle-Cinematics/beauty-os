"use client";

import dynamic from "next/dynamic";

const Toaster = dynamic(() => import("@/components/toast").then((mod) => mod.Toaster), { ssr: false });
const FlashToaster = dynamic(() => import("@/components/flash-toaster").then((mod) => mod.FlashToaster), { ssr: false });
const FormConfirmationProvider = dynamic(
  () => import("@/components/form-confirmation-provider").then((mod) => mod.FormConfirmationProvider),
  { ssr: false },
);
const ServiceWorkerRegister = dynamic(
  () => import("@/components/service-worker-register").then((mod) => mod.ServiceWorkerRegister),
  { ssr: false },
);

export function LazyRootProviders() {
  return (
    <>
      <ServiceWorkerRegister />
      <FormConfirmationProvider />
      <Toaster />
      <FlashToaster />
    </>
  );
}
