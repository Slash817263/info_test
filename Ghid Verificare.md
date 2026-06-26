# Ghid de Verificare Pas cu Pas: Netlify, GitHub & Supabase

Acest ghid te va ajuta să verifici dacă integrarea automată între GitHub, Netlify și baza de date Supabase funcționează perfect.

---

## Pasul 1: Verifică dacă Automatizarea GitHub $\rightarrow$ Netlify funcționează

Deoarece ai configurat conexiunea automată între GitHub și Netlify, orice modificare pe care o faci local trebuie să se actualizeze singură pe site.

### Cum testezi:
1. Deschide fișierul `index.html` pe calculatorul tău.
2. Modifică un text mic (de exemplu, în titlu, adaugă un caracter sau un cuvânt temporar).
3. Salvează fișierul.
4. Deschide terminalul în VS Code și rulează aceste comenzi pentru a urca modificarea pe GitHub:
   ```powershell
   git add index.html
   git commit -m "Test deploy automat"
   git push origin main
   ```
5. Mergi pe [dashboard-ul tău Netlify](https://app.netlify.com/projects/test-introductiv-info/overview).
6. Ar trebui să vezi o notificare că un nou build a pornit automat (scrie **"Building"**, apoi se schimbă în **"Published"** sau **"Ready"**).
7. Accesează link-ul public al site-ului tău oferit de Netlify și verifică dacă modificarea pe care ai făcut-o apare online.

*Dacă modificarea a apărut, automatizarea GitHub-Netlify funcționează de nota 10!*

---

## Pasul 2: Verifică Variabilele de Mediu (Conexiunea la Supabase)

Pentru ca site-ul tău de pe Netlify să poată citi întrebările și să salveze rezultatele elevilor, trebuie ca Netlify să aibă acces la cheile secrete din Supabase.

### Cum verifici:
1. În Netlify, mergi la site-ul tău $\rightarrow$ **Site configuration** $\rightarrow$ **Environment variables**.
2. Asigură-te că ai adăugat exact aceste 3 variabile:
   * `SUPABASE_URL` (valoarea din `.env` local)
   * `SUPABASE_KEY` (valoarea din `.env` local)
   * `SUPABASE_SERVICE_KEY` (valoarea din `.env` local)
3. Dacă ai adăugat sau modificat variabilele acum, s-ar putea să fie nevoie să dai un **Trigger deploy** manual din tab-ul **Deploys** de pe Netlify pentru ca noile chei să fie injectate în server.

---

## Pasul 3: Testează Funcționalitatea Completă (End-to-End)

Acum vom rula un test cap-coadă ca un elev obișnuit.

### Testul 1: Încărcarea Întrebărilor
1. Deschide link-ul public al aplicației tale Netlify în browser.
2. Dacă ecranul de pornire îți permite să scrii numele și **NU** apare eroarea verde *"Eroare la incarcarea testului"*, înseamnă că Netlify a reușit să citească întrebările din baza de date.
3. Verifică dacă **Întrebarea 23** este cea nouă, despre arbori și vectorul de tați.

### Testul 2: Trimiterea și Salvarea unui Rezultat
1. Pe ecranul de start, introdu un nume de test (ex: `Elev Test Automat`).
2. Răspunde la întrebări (poți trece rapid prin ele, dar asigură-te că selectezi câte o opțiune la fiecare pentru a putea merge mai departe).
3. La final, apasă pe **Finalizează Testul**.
4. Verifică dacă se încarcă ecranul de rezultate (cu scorul obținut, timpul de lucru și detaliile întrebărilor).

### Testul 3: Verificarea în Panoul de Administrare
1. În subsolul paginii de start a site-ului tău public (sau navigând direct la `https://nume-site.netlify.app/admin.html`), deschide panoul de administrare.
2. Verifică dacă testul trimis mai devreme (cu numele `Elev Test Automat`) apare în tabel, cu scorul și timpul corect de lucru.
3. Apasă pe **Descarcă CSV** pentru a te asigura că fișierul se descarcă corect și conține datele introduse.

---

## 💡 Sfaturi în caz de erori:

* **Întrebările nu se încarcă (apare eroare la start):**
  Verifică consola browser-ului (F12 $\rightarrow$ tab-ul *Console*). Dacă vezi erori `401` sau `403`, înseamnă că variabilele `SUPABASE_URL` sau `SUPABASE_KEY` adăugate în setările Netlify sunt greșite sau conțin spații/caractere în plus.
* **Rezultatele nu se salvează în admin:**
  Asigură-te că ai rulat schema bazei de date în editorul SQL din Supabase (tabelele `questions` și `results` trebuie să existe în baza ta de date).
