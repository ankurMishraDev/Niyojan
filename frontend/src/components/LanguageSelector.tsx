import React from 'react';
import { useTranslation } from 'react-i18next';

export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिंदी (Hindi)' },
  { code: 'bn', label: 'বাংলা (Bengali)' },
  { code: 'te', label: 'తెలుగు (Telugu)' },
  { code: 'mr', label: 'मराठी (Marathi)' },
  { code: 'ta', label: 'தமிழ் (Tamil)' },
  { code: 'ur', label: 'اردو (Urdu)' },
  { code: 'gu', label: 'ગુજરાતી (Gujarati)' },
  { code: 'kn', label: 'ಕನ್ನಡ (Kannada)' },
  { code: 'ml', label: 'മലയാളം (Malayalam)' },
  { code: 'or', label: 'ଓଡ଼ିଆ (Odia)' },
  { code: 'pa', label: 'ਪੰਜਾਬી (Punjabi)' },
  { code: 'as', label: 'অসমীয়া (Assamese)' },
  { code: 'mai', label: 'मैथिली (Maithili)' },
  { code: 'sat', label: 'ᱥᱟᱱᱛାᱲᱤ (Santali)' },
  { code: 'ks', label: 'کأشُر (Kashmiri)' },
];

export function LanguageSelector() {
  const { i18n } = useTranslation();

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLang = e.target.value;
    localStorage.setItem('niyojan_preferred_language', newLang);
    i18n.changeLanguage(newLang).then(() => {
      // Reload as per user request to ensure everything updates cleanly
      window.location.reload();
    });
  };

  return (
    <div className="relative inline-block">
      <select
        value={i18n.language}
        onChange={handleLanguageChange}
        className="block w-full rounded-md border border-hairline bg-canvas py-1.5 pl-3 pr-8 text-sm text-ink focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary appearance-none cursor-pointer"
        aria-label="Select Language"
      >
        {LANGUAGES.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.label}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-mute">
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
}
