import "./globals.css";

export const metadata = {
  title: "MotorGuard — Motor Health Dashboard",
  description: "Real-time motor predictive maintenance system",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
