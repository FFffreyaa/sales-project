import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const incomingHeaders = await headers();
  const host = incomingHeaders.get("x-forwarded-host") ?? incomingHeaders.get("host") ?? "localhost:3000";
  const protocol = incomingHeaders.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;

  return {
    title: "钱江电气｜销售项目管理",
    description: "围绕客户关系、关键资源、项目运作与标的物版本的一体化销售项目工作台。",
    openGraph: {
      title: "钱江电气｜销售项目管理",
      description: "从机会运作，到赢单移交。",
      images: [{ url: `${origin}/og.png`, width: 1731, height: 909, alt: "钱江电气销售项目管理" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "钱江电气｜销售项目管理",
      description: "从机会运作，到赢单移交。",
      images: [`${origin}/og.png`],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
