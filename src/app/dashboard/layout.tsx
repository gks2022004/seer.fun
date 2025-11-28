import DashboardLayout from "@/components/dashboard-layout";
import WalletContextProvider from "@/components/wallet-provider";

export default function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <WalletContextProvider>
      <DashboardLayout>{children}</DashboardLayout>
    </WalletContextProvider>
  );
}
