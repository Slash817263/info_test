# Propuneri pentru Automatizarea Procesului Educațional

Acest document conține 5 sugestii majore de extindere a platformei pentru a automatiza evaluarea, feedback-ul și recuperarea lacunelor elevilor.

---

### 1. 📄 Generarea și Trimiterea Automată a Fișei de Remedieri (PDF / Email)
* **Concept**: După finalizarea testului, sistemul analizează categoriile deficitare (unde elevul a obținut sub 70% corectitudine) și generează instantaneu un raport de analiză personalizat.
* **Automatizare**: 
  - Generarea unui PDF descărcabil direct din browser folosind o librărie precum `jspdf`.
  - Trimiterea automată a raportului pe e-mailul elevului și al tutorelui (folosind un serviciu de mail precum SendGrid/EmailJS integrat în Netlify Functions).
  - Fiecare fișă va conține **recomandări de resurse specifice** (de exemplu: *"Pentru capitolul Recursivitate, îți recomandăm să citești lecția X de pe PbInfo și să rezolvi problemele #123 și #456"*).

---

### 2. 📊 Panou de Monitorizare (Dashboard) Detaliat pentru Profesor
* **Concept**: Extinderea paginii `admin.html` într-un dashboard interactiv dedicat profesorului/tutorelui pentru a urmări progresul global și individual.
* **Automatizare**:
  - **Statistici agregate**: Afișarea automată a temelor cel mai frecvent greșite (ex: *"80% dintre elevi au greșit întrebările legate de Transmiterea prin Referință"*). Acest lucru ajută profesorul să știe exact ce subiecte trebuie să predea/recapituleze la următoarea ședință.
  - **Evoluția elevilor**: Grafice cu evoluția scorurilor elevilor de la un test la altul.
  - **Filtrare**: Sortare pe grupe/clase de elevi.

---

### 3. 🧠 Integrare IA pentru Generare Adaptivă de Întrebări (Gemini API)
* **Concept**: Folosirea unui model de inteligență artificială (precum Gemini API printr-o funcție Netlify) pentru a crea o experiență de învățare dinamică.
* **Automatizare**:
  - **Variații de cod**: Generarea automată de fragmente de cod C++ similare cu cele din baza de date, dar cu valori sau condiții ușor modificate, pentru a preveni memorarea răspunsurilor.
  - **Întrebări adaptive**: Dacă elevul greșește la capitolul "Matrice", sistemul generează automat și pe loc 3 întrebări suplimentare, mai simple, din acel capitol, pentru a-l ajuta să înțeleagă conceptul înainte de a trece mai departe.

---

### 4. 🏆 Sistem de Gamification & Recompense (Badges)
* **Concept**: Creșterea implicării și a motivației elevilor prin introducerea unor elemente de joc direct în platformă.
* **Automatizare**:
  - **Insigne automate (Badges)** acordate la finalizarea testului în funcție de performanță:
    - *Recursion Wizard* (100% corect la capitolul Recursivitate).
    - *Code Optimizer* (timp de răspuns mediu extrem de rapid).
    - *Tenacious Coder* (dacă a recuperat punctaj de la un test anterior).
  - Salvarea acestor realizări în profilul elevului (legat de baza de date) și posibilitatea de a le distribui pe rețelele sociale sau de a le trimite profesorului ca o dovadă a progresului.

---

### 5. 💬 Notificări Automate pe WhatsApp (API Cloud) și Google Classroom
* **Concept**: Integrarea directă a platformei de testare cu sistemele de comunicare utilizate zilnic de elevi, părinți și profesori.
* **Automatizare**:
  - **WhatsApp API**: În loc ca elevul să trimită manual un mesaj pe WhatsApp prin link pre-completat, sistemul trimite automat un mesaj structurat direct pe numărul profesorului sau al părintelui imediat ce testul este finalizat (folosind Twilio sau WhatsApp Business API).
  - **Google Classroom API**: Înrolarea automată a notelor obținute la test în catalogul virtual Google Classroom al clasei respective, eliminând necesitatea ca profesorul să introducă manual notele.
