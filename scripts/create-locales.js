const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '../frontend/src/i18n/locales');
const enJson = fs.readFileSync(path.join(localesDir, 'en.json'), 'utf8');

const languages = [
  'hi', 'bn', 'te', 'mr', 'ta', 
  'ur', 'gu', 'kn', 'ml', 'or', 
  'pa', 'as', 'mai', 'sat', 'ks'
];

languages.forEach(lang => {
  const filePath = path.join(localesDir, `${lang}.json`);
  fs.writeFileSync(filePath, enJson, 'utf8');
  console.log(`Created ${lang}.json`);
});
