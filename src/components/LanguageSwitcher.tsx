import React from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  return (
    <button 
      onClick={() => {
        i18n.changeLanguage(i18n.language === 'en' ? 'ar' : 'en');
        document.documentElement.dir = i18n.language === 'en' ? 'rtl' : 'ltr'; 
      }}
      className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
    >
      <Globe className="w-4 h-4 ltr:mr-2 rtl:ml-2 font-sans" />
      <span className="font-sans">{i18n.language === 'en' ? 'عربي' : 'English'}</span>
    </button>
  );
}
