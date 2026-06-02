import './globals.css';

export const metadata = {
  title: 'Piston Lawn Service',
  description: 'Book your lawn care slots instantly.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}