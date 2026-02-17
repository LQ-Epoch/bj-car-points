import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "北京新能源家庭积分计算器",
  description: "参考北京市政策规则的家庭新能源积分估算工具",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
