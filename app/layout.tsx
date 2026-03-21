export const metadata = {
  title: 'poc-strava-webhook',
  description: 'Throwaway POC — Strava webhook + n8n forwarding',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
