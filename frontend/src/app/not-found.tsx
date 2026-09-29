import Link from "next/link";

export default function NotFound() {
  return <div><h1 className="text-2xl font-semibold">Không tìm thấy trang</h1><Link href="/" className="mt-4 inline-block text-accent underline">Về trang chủ</Link></div>;
}
