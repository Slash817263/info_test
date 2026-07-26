## Plan de Extindere: Platformă Educațională C++

Acest document reprezintă planul tehnic pentru extinderea testului introductiv de informatică și implementarea funcționalităților avansate de analiză și generare.

---

### 0. Modul de Management al Întrebărilor (CMS integrat în admin.html)

Dezvoltarea unei secțiuni dedicate în panoul profesorului pentru gestionarea completă a bazei de date cu întrebări, eliminând necesitatea interogărilor SQL manuale.

* **Interfață Vizuală de Editare:** Formular intuitiv pentru adăugarea/modificarea enunțurilor, incluzând un editor de cod C++ integrat (ex. Monaco Editor) care păstrează formatarea și indentarea.
* **Suport pentru Șabloane IA:** Posibilitatea definirii de parametri și variabile (ex. `{VAL1}`, `{STR}`) direct în interfață, creând bazele pe care motorul IA va aplica mutațiile.
* **Mapare Structurală:** Selectare rapidă din drop-down a categoriei, subcategoriei și dificultății de pornire, esențiale pentru integrarea nativă cu sistemul de analiză și Elo.
* **Pre-validare Sandbox:** Facilitate prin care profesorul poate testa și rula codul C++ direct din formular înainte de a salva întrebarea, garantând corectitudinea variantelor adăugate în sistem.

---

### 1. Configurație Generală și Dificultate

Parametrii de bază pentru evaluarea inițială au fost ajustați pentru a oferi o curbură de testare precisă și echilibrată. (Aceste teste statice extrag datele direct din CMS-ul recent configurat).

| Parametru | Valoare | Detalii |
| :--- | :--- | :--- |
| **Timp total** | 30 minute | Timp extins pentru a acomoda noul volum de lucru. |
| **Total Întrebări** | 50 întrebări | Extindere necesară pentru acoperirea integrală a materiei. |
| **Dificultate Ușoară** | 20 întrebări | Verificarea cunoștințelor de bază și a sintaxei. |
| **Dificultate Medie** | 20 întrebări | Nivel intermediar de logică algoritmică. |
| **Dificultate Grea** | 10 întrebări | Probleme complexe și tehnici de optimizare. |

---

### 2. Structura Întrebărilor pe Categorii

Materia este segmentată strategic. Această taxonomie este oglindită în opțiunile de clasificare din `admin.html`, permițând etichetarea automată a fiecărui șablon nou adăugat.

| Categorie Principală (Total) | Subcategorie | Nr. Întrebări |
| :--- | :--- | :--- |
| **Fundamente (15)** | Citire și afișare | 3 |
| **Fundamente** | Operatori și expresii | 5 |
| **Fundamente** | Structuri de control | 4 |
| **Fundamente** | Complexități | 3 |
| **Organizarea Datelor (13)** | Vectori (tablouri unidimensionale) | 3 |
| **Organizarea Datelor** | Matrice (tablouri bidimensionale) | 3 |
| **Organizarea Datelor** | Șiruri de caractere | 4 |
| **Organizarea Datelor** | Structuri de date (struct / record) | 3 |
| **Subprograme (8)** | Transmitere prin valoare | 4 |
| **Subprograme** | Transmitere prin referință | 2 |
| **Subprograme** | Recursivitate | 2 |
| **Backtracking (4)** | Teorie și aplicare practică | 4 |
| **Grafuri și Arbori (10)** | Terminologie grafuri | 4 |
| **Grafuri și Arbori** | Grafuri orientate | 2 |
| **Grafuri și Arbori** | Grafuri neorientate | 2 |
| **Grafuri și Arbori** | Arbori | 2 |

---

### 3. Arhitectură, Analiză și Remedieri Automate

Direcțiile tehnice pentru transformarea aplicației dintr-un test static într-un motor de evaluare formativă, bazat pe șabloanele administrate în CMS.

* **Generare Dinamică:** Crearea automată a testelor unice de 30 de întrebări prin extragerea inteligentă a structurilor din baza de date centrală.
* **Mutație IA:** IA-ul consumă șabloanele cu variabile salvate prin `admin.html` și alterează automat parametrii numerici, numele de variabile și ordinea opțiunilor pentru a preveni memorarea.
* **Analiză de Performanță:** Corelarea răspunsurilor greșite cu categoriile specifice de materie (etichetate la pasul 0) pentru identificarea exactă a blocajelor.
* **Plan de Remedieri:** Generarea unui traseu de învățare personalizat pe baza lacunelor detectate automat.
* **Balansare Dinamică (Elo):** Calibrarea dificultății întrebărilor în timp real, adaptându-se la nivelul demonstrat de utilizator, suprascriind dificultatea de bază alocată inițial de profesor.

---

### 4. Funcționalități Dashboard și Securitate

Instrumente unificate în `admin.html` pentru administrarea platformei, monitorizarea claselor și protejarea integrității mediului de testare.

* **Panou Profesor Unificat:** O interfață singulară care îmbină CMS-ul pentru întrebări cu rapoartele agregate, semnalând automat conceptele predispuse la erori la nivel de grupă.
* **Evoluție și Filtrare:** Integrarea graficelor de evoluție a scorurilor individuale și funcții de sortare pe clase/grupe.
* **Securitate Anti-Cheat:** Captarea evenimentelor `blur` și `focus` pentru a înregistra părăsirea paginii în timpul examinării.
* **Analiză Timp Răspuns:** Monitorizarea timpului alocat fiecărei întrebări pentru a detecta comportamente neobișnuite.
* **Compilare tip Sandbox comun:** Același serviciu de izolare și validare a codului C++ este folosit de două ori: o dată de profesor pentru pre-validarea întrebărilor în CMS și o dată de elevi pentru evaluarea răspunsurilor care necesită scriere de cod.