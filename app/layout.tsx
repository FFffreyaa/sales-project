import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "钱江电气销售项目管理 APP｜交互演示",
  description: "围绕销售项目主动运作、阶段门和标的物版本追溯的本地交互演示原型。",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
