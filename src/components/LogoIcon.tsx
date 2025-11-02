// components/LogoIcon.tsx
import Link from 'next/link';

export default function LogoIcon() {
  return (
    <Link href="/" className="inline-block">
      <img
        src="/next.svg"
        alt="Logo"
        className="h-10 w-auto cursor-pointer"
      />
    </Link>
  );
}
