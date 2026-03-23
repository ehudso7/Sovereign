import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sovereign Docs',
  description: 'Sovereign documentation',
};

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
