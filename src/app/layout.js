import './globals.css';

export const metadata = {
  title: 'Jamie Rush Services',
  description: 'Book your lawn care slots instantly.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}