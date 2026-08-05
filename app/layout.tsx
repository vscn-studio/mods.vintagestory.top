import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'VSCN Mod DB | 复古物语中文社区',
  description: '汇聚复古物语各类本地化模组的中文社区平台',
  icons: {
    icon: '/brand/logo-icon-rounded.svg'
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
