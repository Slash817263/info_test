# 📋 Ghid de Testare Manuală & Audit – Tudor (AcaDe-QUIZ)

Acest ghid conține scenariile cheie de testare pe care le poți parcurge în aplicație (`localhost:8888` sau link-ul de producție) pentru a verifica fiecare funcționalitate și a depista eventualele bug-uri vizuale, de logică sau de sincronizare.

Pe măsură ce testezi, bifează căsuțele `[x]` și notează orice comportament ciudat sau eroare apărută în consolă (`F12 -> Console`).

---

## 🧑‍🎓 1. Fluxul Elevului (Student Experience)

### A. Autentificare & Abonament
- [x] **Autentificare cu succes**: Introdu un cont de elev valid. Ar trebui să fii redirecționat instant în Dashboard.
- [x] **Parolă greșită**: Introdu o parolă greșită. Verifică dacă primești mesaj roșu de eroare clar („Parolă incorectă” sau similar) și nu se blochează pagina.
- [x] **Utilizator inexistent**: Introdu un nume la întâmplare. Verifică mesajul afișat.
- [x] **Verificare Abonament Expirat**:
  - Mergi în Admin și setează pentru un cont data de expirare în trecut (ex: `2024-01-01`).
  - Încearcă să te loghezi cu acel elev.
  - *Comportament corect*: Utilizatorul este notificat că abonamentul a expirat (banner dedicat cu data expirării și buton direct WhatsApp către profesor), iar accesul la teste noi și antrenament este blocat în timp ce istoricul rămâne consultabil.
- [x] **Deconectare (Logout)**: Apasă butonul de ieșire. Verifică că `localStorage` este curățat și revii la ecranul de login.

### B. Susținerea unui Test (Quiz / Test Inițial)
- [x] **Pornire test**: Alege un tip de examen (ex: Academie / BAC / Poli) și începe testul.
- [x] **Cronometru**: Verifică dacă timpul curge descrescător corect și dacă la expirare testul se încheie automat.
- [x] **Navigare între întrebări**:
  - Mergi înainte și înapoi între întrebări.
  - Răspunsurile bifate anterior trebuie să rămână selectate.
  - Verifică dacă codul C++ sau formulele matematice se văd clar, fără suprapuneri.
- [x] **Test Salvare Progres la Reload (F5)**:
  - Răspunde la 3 întrebări, apoi dă **Refresh (F5)** la pagină.
  - *Comportament corect*: Pagina restaurează exact întrebarea curentă, răspunsurile selectate, timpul rămas și setul de întrebări din localStorage / server!
- [x] **Finalizare & Trimitere (Submit)**:
  - Apasă butonul de finalizare test.
  - Apasă de 2 ori rapid pe buton (spam-click) -> verificat: butonul se dezactivează instant la click, iar backend-ul conține protecție anti-dublare și rate-limiting.
- [x] **Ecran Rezultate**:
  - Nota/procentajul este calculat corect (ex: 9/10 = 90% sau nota 9.00).
  - Se afișează analiza pe capitole (Fundamente, Grafuri, etc.).
  - Întrebările greșite arată clar care era varianta corectă și explicația/hintul.
  - Trimiterea raportului prin email este gestionată de Netlify Function.

### C. Modul Antrenament / Lucru Individual (Practice)
- [x] **Deschidere secțiune Antrenament**: Intră în modul de exersare.
- [x] **Afișare capitole & bare de progres**: Verifică dacă categoriile canonice (Fundamente, Organizarea Datelor, Subprograme, Backtracking, Grafuri și Arbori) au procente și subcategorii afișate.
- [x] **Pornire sesiune pe o subcategorie**: Alege o subcategorie (ex: „Vectori”) și începe.
- [x] **Rezolvate corect vs greșit**:
  - Răspunde corect -> contorizat instant ca rezolvată corect („mastered”).
  - Răspunde greșit -> întrebarea reintră în coada adaptivă cu prioritate ridicată pentru reluare.
- [x] **Stăpânire & Salvare Progres**: Verificat: fiecare exercițiu rezolvat corect este salvat în baza de date și crește acoperirea materiei elevului (afișat ca „Rezolvate corect”).

### D. Teme Asignate (Assigned Tests)
- [x] **Vizualizare temă nouă**: Dacă adminul ți-a dat o temă, verifică dacă apare notificarea/cardul cu tema asignată în dashboard (cu titlu personalizat sau predefinit).
- [x] **Rezolvare temă**: Deschide tema, rezolv-o și trimite rezultatele (cu posibilitate de salvare intermediară a progresului la ieșire).
- [x] **Actualizare status**: După trimitere, tema este marcată ca „completed” și salvată în baza de date cu titlul corect.

---

## 🛠️ 2. Panoul de Administrare (Admin Panel)

Accesează `/admin.html` și autentifică-te.

### A. Bara de Navigare & Filtrare Întrebări
- [x] **Click pe tab-ul „📚 Întrebări”**:
  - Dă click pe buton. Comută direct la tab-ul de întrebări, iar badge-ul afișează totalul corect de întrebări din sistem.
- [x] **Pastilele de categorii (Pills Bar)**:
  - Butoanele pastilă de sub titlu (Toate, Academie, BAC, Poli, Diverse, Test Inițial) acoperă lățimea ecranului, textele sunt centrate, iar filtrarea pe categorie este instantanee.

### B. Tabul „📊 Situație” (Rezultate & Drilldown Elevi)
- [x] **Listă elevi**: Încărcare automată a tuturor elevilor cu medii, număr de teste și sistem de alertă triage pentru riscuri.
- [x] **Căutare elev**: Filtrare în timp real după nume și username fără diacritice.
- [x] **Detalii elev (Drilldown)**:
  - Click pe cardul elevului -> se deschide ecranul cu istoricul testelor și harta de acoperire (radar SVG).
  - Click pe „Detalii” la un test -> afișează fiecare întrebare cu variantele bifate și explicația.
  - Butonul `← Înapoi` readuce grila fără erori de DOM.
- [x] **Ștergere rezultat**: Buton de ștergere cu confirmare (`confirm()`) și revert automat la status `pending` cu extindere 24h dacă testul era o temă asignată.

### C. Tabul „👥 Conturi” (Gestiune Elevi)
- [x] **Adăugare Elev**:
  - Modal adăugare elev cu username, parolă generată/personalizată (scrypt), număr de telefon normalizat și valabilitate abonament.
  - Apare instant în listă după salvare.
- [x] **Editare Elev**:
  - Modificare termen de expirare și număr de telefon prin modale dedicate.
- [x] **Resetare Parolă**:
  - Prompt securizat pentru parolă nouă, hash scrypt generat pe server.
- [x] **Ștergere Elev**:
  - Mesaj de confirmare GDPR; șterge în cascadă rezultatele, temele și contul.

### D. Tabul „📋 Teste Predefinite”
- [x] **Creare Test Predefinit Nou**:
  - Titlu, tip examen (BAC/Poli/Academie), durată în minute.
- [x] **Completare aleatorie întrebări**:
  - Algoritm Fisher-Yates pentru completare rapidă până la numărul țintă.
- [x] **Selecție manuală a întrebărilor**:
  - Modal cu căutare, filtrare pe categorii și acțiuni rapide de Swap (aleatoriu) sau Replace (manual).
- [x] **Salvare & Asignare**:
  - Salvare în tabela `preset_tests`; asignare individuală (cu previzualizare draft) sau colectivă (Bulk Assign) cu termen limită configurat pe format 24h.

### E. Tabul „📚 Întrebări” (CRUD & Editor)
- [x] **Filtrare Avansată**:
  - Filtre combinate: Categorie + Subcategorie + Dificultate + Căutare text (accent-insensitive).
- [x] **Adăugare Întrebare Nouă**:
  - Modal `+ Adaugă Întrebare` cu preview KaTeX în timp real, câmpuri de cod C++, imagini multiple și suport 2-6 variante.
- [x] **Editare Întrebare Existentă**:
  - Salvare directă cu validare strictă a taxonomiei canonice.

### F. Tabul „⏳ În Așteptare”
- [x] **Listare întrebări în așteptare**: Afișare badge-uri, cod, variante și hinturi.
- [x] **Aprobare / Trimitere în Baza Principală**: Aprobare individuală sau „Aprobă Toate” cu mutare automată în tabela `questions`.
- [x] **Respingere / Ștergere**: Ștergere securizată din coada de așteptare.

### G. Tabul „📬 Leads”
- [x] **Vizualizare solicitări**: Datele din formularul public (diagnostic lead) apar cu scor, focus și număr de telefon.
- [x] **Contact Rapid**: Buton dedicat cu link direct `https://wa.me/` pentru contact pe WhatsApp.
- [x] **Conversie în Cont Elev**: Modal de conversie care sugerează username, generează parolă, setează termenul abonamentului și transformă testul diagnostic în test inițial oficial.

---

## ⚡ 3. Cazuri Limită, Performanță & Edge Cases

- [x] **Rezoluții & Mobile (Responsive)**:
  - Breakpoint-uri CSS dedicate (`<650px`, `<540px`) pentru modalele de preset, assign, bulk-assign și bara de pastile.
- [x] **Diacritice & Simboluri Speciale**:
  - Căutare normalizată (NFD) fără conflicte între `ș/ş` sau `ț/ţ`.
- [x] **Întrebări cu imagini**:
  - Lightbox modal integrat cu zoom la click și închidere pe tasta Escape sau click exterior.
- [x] **Formule KaTeX**:
  - Delimitatori KaTeX standard (`$$...$$`, `$...$`, `\(...\)`, `\[...\]`) randate fără erori.

---

## 📝 Notițe & Bug-uri Identificate de Tudor

Dacă găsești o problemă în timpul testării, noteaz-o mai jos în următorul format:
1. **Unde s-a întâmplat**: (ex: Tabul Întrebări -> Editare întrebare)
2. **Ce ai făcut**: (ex: Am apăsat pe Salvează fără să pun varianta corectă)
3. **Ce s-a întâmplat greșit**: (ex: A apărut un ecran alb sau s-a blocat butonul)
4. **Mesaj consolă F12** (dacă există):

*(Notează aici orice observație)*
