import Image from 'next/image';
import Link from 'next/link';

interface LogoProps {
  className?: string;
  theme?: 'dark' | 'light';
  height?: number;
  showSubtitle?: boolean;
}

export default function Logo({
  className = '',
  theme = 'dark',
  height = 28,
  showSubtitle = true,
}: LogoProps) {
  // Width calculated based on 1024x445 aspect ratio (~2.3x)
  const width = Math.round(height * 2.3);

  return (
    <Link href="/" className={`inline-flex items-center space-x-2 group ${className}`}>
      <div className="relative flex items-center">
        <Image
          src="/logo.png"
          alt="Evee Logo"
          width={width}
          height={height}
          priority
          className={`h-auto object-contain transition ${
            theme === 'light' ? 'invert brightness-0 [filter:invert(1)_brightness(0)]' : ''
          }`}
          style={{ maxHeight: `${height}px`, width: 'auto' }}
        />
      </div>
      {showSubtitle && (
        <span
          className={`mono-eyebrow text-[10px] tracking-widest pl-1.5 border-l ${
            theme === 'dark' ? 'text-white/40 border-white/20' : 'text-black/40 border-black/15'
          }`}
        >
          PROSPECTING
        </span>
      )}
    </Link>
  );
}
