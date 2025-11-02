'use client';

import { useRouter } from 'next/navigation';

function LanguageSelector({ locale }: { locale: string }) {
  const router = useRouter();

  function handleLanguageChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newLocale = e.target.value;
    // Set cookie to remember locale
    document.cookie = `locale=${newLocale}; path=/; max-age=31536000`; // 1 year
    // Reload page to load new locale in server component
    router.refresh();
  }

  return (
    <div style={{ marginTop: '1rem', marginBottom: '2rem' }}>
      <label htmlFor="locale-select">Select Language: </label>
      <select id="locale-select" onChange={handleLanguageChange} value={locale}>
        <option value="en">English</option>
        <option value="es">Español</option>
      </select>
    </div>
  );
}

export default LanguageSelector;
