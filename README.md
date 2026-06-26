# Test Introductiv Informatică C++

Aplicație web SPA (Single Page Application) pentru evaluarea nivelului inițial al elevilor la informatică C++.

## 📋 Funcționalități

- **30 de întrebări** C++ pe 3 nivele de dificultate (ușoară, medie, grea)
- **Sistem de scoring** cu puncte diferențiate (1/2/3 puncte per nivel)
- **Clasificare automată** a nivelului (Începător → Expert)
- **Design responsive** — funcționează pe desktop, tabletă și telefon
- **Partajare rezultate** — WhatsApp, Email, Copy-to-clipboard
- **Fără dependințe** — un singur fișier HTML

## 🚀 Deploy gratuit pe Netlify

### Varianta 1 — Drag & Drop (cea mai simplă)

1. Intră pe [app.netlify.com](https://app.netlify.com)
2. Creează cont gratuit (cu GitHub sau email)
3. Pe dashboard, trage folderul `Informatica Test Introductiv` în zona "Drag and drop"
4. Gata! Primești un link de genul `https://random-name.netlify.app`
5. (Opțional) Schimbă numele site-ului din **Site settings** → **Change site name**

### Varianta 2 — GitHub Pages (alternativă)

1. Creează un repository nou pe GitHub
2. Upload fișierul `index.html`
3. Du-te la **Settings** → **Pages** → selectează branch-ul `main`
4. Link-ul va fi `https://username.github.io/repo-name`

## ⚙️ Configurare (opțional)

Deschide `index.html` și modifică secțiunea `CONFIG` din JavaScript:

```javascript
const CONFIG = {
    // Numărul tău de telefon (cu prefix de țară, fără +)
    tutorPhone: '40712345678',
    // Email-ul tău
    tutorEmail: 'tudor@exemplu.com',
};
```

Astfel, butoanele de partajare vor trimite rezultatele direct către tine.

## 📊 Sistem de Scoring

| Dificultate | Puncte/întrebare | Întrebări | Total posibil |
|------------|------------------|-----------|---------------|
| Ușoară     | 1 punct          | 10        | 10 puncte     |
| Medie      | 2 puncte         | 10        | 20 puncte     |
| Grea       | 3 puncte         | 10        | 30 puncte     |
| **Total**  |                  | **30**    | **60 puncte** |

### Clasificare nivel

| Punctaj    | Nivel          |
|-----------|----------------|
| 0 – 20   | 🌱 Începător   |
| 21 – 35  | 📘 Intermediar |
| 36 – 50  | 🚀 Avansat     |
| 51 – 60  | 🏆 Expert      |
