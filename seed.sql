-- Ștergem datele vechi și resetăm ID-ul ca să fim curați
TRUNCATE TABLE questions RESTART IDENTITY;

-- Inserăm cele 50 de întrebări noi, simplificate și structurate pe niveluri de dificultate
INSERT INTO questions (difficulty, type, category, subcategory, text, code, options_json, correct_index, explanation) VALUES
('easy', 'code', 'Fundamente', 'Citire si afisare date', 'Ce afișează următorul cod pe ecran, dacă introduci de la tastatură numărul 5?', 'int x;\ncin >> x;\ncout << x * 2;', '["5","10","x * 2","Eroare"]'::jsonb, 1, 'Comanda cin citește valoarea 5 în variabila x. Apoi cout afișează 5 * 2, adică 10.'),
('easy', 'choice', 'Fundamente', 'Citire si afisare date', 'Cum afișezi corect textul "Salut" pe ecran în C++?', NULL, '["cin >> \"Salut\";","cout << \"Salut\";","print(\"Salut\");","scrie \"Salut\";"]'::jsonb, 1, 'Pentru a afișa un text pe ecran în C++, folosim comanda cout urmată de operatorul <<.'),
('easy', 'choice', 'Fundamente', 'Citire si afisare date', 'Dacă vrei să treci la rând nou pe ecran, ce poți folosi împreună cu cout?', NULL, '["endl","space","next","enter"]'::jsonb, 0, 'Cuvântul endl vine de la "end line" (sfârșit de rând) și mută textul următor pe un rând nou.'),
('easy', 'choice', 'Fundamente', 'Operatori si expresii', 'Ce rezultat are expresia matematică 10 % 3 în C++?', NULL, '["3","1","0","3.33"]'::jsonb, 1, 'Operatorul % calculează restul împărțirii. 10 împărțit la 3 dă 3, rest 1. Deci rezultatul este 1.'),
('easy', 'choice', 'Fundamente', 'Operatori si expresii', 'Care este rezultatul calculului 5 / 2 în C++?', NULL, '["2.5","3","2","0"]'::jsonb, 2, 'În C++, când împarți două numere întregi (fără virgulă), rezultatul este tot întreg. Partea zecimală (0.5) este ștearsă.'),
('easy', 'choice', 'Fundamente', 'Operatori si expresii', 'Ce valoare va avea variabila x după codul următor?', 'int x = 5;\nx++;', '["4","5","6","10"]'::jsonb, 2, 'Operatorul ++ crește valoarea variabilei cu 1. Deci a devine 5 + 1 = 6.'),
('medium', 'choice', 'Fundamente', 'Operatori si expresii', 'Ce valoare are expresia următoare?', '10 - 5 / 2 * 3', '["6","2.5","4","7.5"]'::jsonb, 2, 'Înmulțirea și împărțirea se fac primele, de la stânga la dreapta. 5 / 2 = 2. Apoi 2 * 3 = 6. La final: 10 - 6 = 4.'),
('medium', 'choice', 'Fundamente', 'Operatori si expresii', 'Ce rezultat dă această condiție logică?', '!(2 > 3 || 3 > 4)', '["0","1","2","Eroare"]'::jsonb, 1, 'Ambele condiții din paranteză sunt false (0). Semnul ! înseamnă negație (NOT). Opusul lui 0 (Fals) este 1 (Adevărat).'),
('easy', 'choice', 'Fundamente', 'Structuri de control', 'Câte numere va afișa următorul cod ?', 'for (int i = 1; i <= 5; i++) {\n    cout << i;\n}', '["4","5","6","Niciunul"]'::jsonb, 1, 'Condiția este i <= 5, pornind de la 1. Deci va afișa: 1, 2, 3, 4, 5. În total 5 repetări.'),
('easy', 'code', 'Fundamente', 'Structuri de control', 'Completează condiția pentru a verifica dacă un număr x este strict pozitiv.', 'if (________) {\n    cout << "Pozitiv";\n}', '["x = 0","x > 0","x < 0","x == 0"]'::jsonb, 1, 'Un număr este strict pozitiv dacă este strict mai mare decât zero (x > 0).'),
('medium', 'choice', 'Fundamente', 'Structuri de control', 'Care va fi valoarea finală a variabilei p?', 'int p = 1;\nint i = 1;\nwhile (i <= 3) {\n    p = p * i;\n    i++;\n}', '["3","4","6","12"]'::jsonb, 2, 'Codul înmulțește numerele de la 1 la 3: 1 * 1 = 1; 1 * 2 = 2; 2 * 3 = 6. Rezultatul final (p) este 6.'),
('easy', 'choice', 'Fundamente', 'Structuri de control', 'Ce afișează această secvență?', 'for (int i = 1; i <= 5; i++) {\n    if (i % 2 == 0) {\n        cout << i << " ";\n    }\n}', '["1 2 3 4 5","1 3 5","2 4","0"]'::jsonb, 2, 'Condiția i % 2 == 0 verifică dacă numărul este par. Din numerele 1,2,3,4,5, doar 2 și 4 sunt pare.'),
('medium', 'choice', 'Fundamente', 'Complexitati', 'Dacă un algoritm execută exact 10 pași indiferent de cât de mari sunt datele de intrare, ce complexitate (timp) are?', NULL, '["O(n)","O(1)","O(n^2)","O(log n)"]'::jsonb, 1, 'O(1) înseamnă "timp constant". Adică algoritmul face mereu același număr de pași, indiferent de cât de mare e numărul introdus de noi (n).'),
('medium', 'choice', 'Fundamente', 'Complexitati', 'Ce complexitate de timp are acest cod?', 'for (int i = 0; i < n; i++) {\n    for (int j = 0; j < n; j++) {\n        cout << i + j;\n    }\n}', '["O(1)","O(n)","O(n^2)","O(log n)"]'::jsonb, 2, 'Primul for se repetă de n ori. Pentru fiecare pas, al doilea for se repetă tot de n ori. Deci facem n * n pași, adică O(n^2).'),
('hard', 'choice', 'Fundamente', 'Complexitati', 'Un agoritm eficient de căutare a unei valori într-un vector sortat de elemente este cel de căutare binară (Binary Search). Ce complexitate are acest algoritm?', 'int binarySearch(int arr[], int size, int target) {\n    int left = 0;\n    int right = size - 1;\n    while (left <= right) {\n        int mid = left + (right - left) / 2;\n        if (arr[mid] == target)\n            return mid;\n        if (arr[mid] < target)\n            left = mid + 1;\n        else\n            right = mid - 1;\n    }\n    return -1;\n}', '["O(1)","O(n)","O(n^2)","O(log n)"]'::jsonb, 3, 'Orice algoritm care împarte repetat problema la 2 (cum face căutarea binară) are o complexitate de O(log n), fiind foarte eficient.'),
('easy', 'choice', 'Organizarea Datelor', 'Vectori', 'Pe ce poziție (index) se află primul element din vectorul v?', 'int v[5] = {10, 20, 30, 40, 50};', '["1","0","v","Nu se poate determina"]'::jsonb, 1, 'În limbajul C++, indexarea vectorilor (numărătoarea elementelor) începe mereu de la poziția 0.'),
('medium', 'choice', 'Organizarea Datelor', 'Vectori', 'Ce valoare va avea suma calculată în acest cod?', 'int v[4] = {1, 2, 3, 4};\nint s = 0;\nfor (int i = 0; i < 3; i++) {\n    s = s + v[i];\n}', '["4","0","10","6"]'::jsonb, 3, 'Codul parcurge și adună elementele de la indexul 0 până la indexul 2 în variabila s: 1 + 2 + 3 = 6. '),
('hard', 'choice', 'Organizarea Datelor', 'Vectori', 'Dacă avem un vector v, ce algoritm descrie următoarea secvență de cod?', 'bool sortat = false;\nwhile (!sortat) {\n    sortat = true;\n    for (int i = 0; i < n - 1; i++) {\n        if (v[i] > v[i+1]) {\n            int temp=v[i]; v[i]=v[i+1]; v[i+1]=temp;\n            sortat = false;\n        }\n    }\n}', '["Cautare Liniara","Bubble Sort","Cautare Binara","Selection Sort"]'::jsonb, 1, 'Acesta este algoritmul de sortare Bubble Sort (metoda bulelor). Verifică vecinii și îi inversează până când tot vectorul este ordonat.'),
('easy', 'choice', 'Organizarea Datelor', 'Matrice', 'Câte elemente are în total această matrice bidimensională?', 'int a[3][3];', '["3","6","9","1"]'::jsonb, 2, 'Numărul total de elemente dintr-o matrice se află înmulțind numărul de linii cu numărul de coloane: 3 * 3 = 9.'),
('medium', 'code', 'Organizarea Datelor', 'Matrice', 'Cum verifici dacă un element de la linia i și coloana j face parte din diagonala principală a unei matrice pătratice?', 'if (________) {\n    cout << "Este pe diagonala principala";\n}', '["i == j","i + j == n - 1","i < j","i > j"]'::jsonb, 0, 'Pe diagonala principală, indicele liniei este mereu egal cu indicele coloanei (ex: 0,0 sau 1,1 sau 2,2). Deci condiția este i == j.'),
('hard', 'choice', 'Organizarea Datelor', 'Matrice', 'Unde se află elementele dintr-o matrice pentru care i < j (indexul liniei este mai mic decât indexul coloanei)?', NULL, '["Sub diagonala principala","Deasupra diagonalei principale","Pe diagonala secundara","Pe prima linie"]'::jsonb, 1, 'Elementele cu i==j se afla pe diagonala principală, cele cu i<j se afla deasupra diagonalei principale, iar cele cu i>j se afla sub diagonala principală.'),
('easy', 'choice', 'Organizarea Datelor', 'Siruri de caractere', 'Ce caracter special se află, invizibil, la finalul oricărui cuvânt (șir de caractere) în C++?', NULL, '["\\n","\\0","\\t","."]'::jsonb, 1, 'În C++, orice șir de caractere (text) se termină cu caracterul special null (\0) pentru ca programul să știe unde se oprește textul.'),
('easy', 'choice', 'Organizarea Datelor', 'Siruri de caractere', 'Câte caractere (litere) va returna funcția strlen pentru cuvântul "examen"?', 'cout << strlen("examen");', '["5","6","7","0"]'::jsonb, 1, 'Funcția strlen numără exact literele pe care le vedem. "examen" are 6 litere.'),
('medium', 'choice', 'Organizarea Datelor', 'Siruri de caractere', 'Ce se va afișa pe ecran?', 'char s[10] = "examen";\ns[2] = ''\0'';\ncout << s;', '["examen","ex","exa","eroare"]'::jsonb, 1, 'Am pus \0 pe poziția 2 (a treia literă, care era "a"). Afișarea se oprește la primul \0, deci se vor afișa doar literele de pe pozițiile 0 și 1: "ex".'),
('medium', 'choice', 'Organizarea Datelor', 'Siruri de caractere', 'Ce face funcția predefinită strcpy(destinatie, sursa)?', NULL, '["Aduna doua texte","Copiaza textul din sursa in destinatie","Numara literele din sursa","Verifica daca sunt la fel"]'::jsonb, 1, 'Numele strcpy vine de la "string copy" (copiere de șir). Ea șterge ce era în variabila destinație și scrie textul din sursă peste.'),
('easy', 'choice', 'Organizarea Datelor', 'Structuri de date (struct)', 'Cum accesăm nota unui elev (o variabilă) grupată într-un "struct Elev"?', 'struct Elev { int nota; };\nElev e;\n// Cum ii dam nota 10?', '["e(nota) = 10;","Elev[nota] = 10;","e.nota = 10;","nota = 10;"]'::jsonb, 2, 'Pentru a accesa componentele unui struct, folosim operatorul punct (.). Variabila e urmată de punct și numele componentei: e.nota.'),
('medium', 'choice', 'Organizarea Datelor', 'Structuri de date (struct)', 'Pentru declaraţia de mai jos precizaţi care din instrucţiunile de atribuire este greşită:', 'struct elev{\n char nume[20];\n int nota1;\n int nota2;\n} e1,e2;', '["e1=e2+1;","e1.nume[2]=’x’;","e1=e2;","e1.nota1=e2.nota2+1;"]'::jsonb, 0, 'Nu poți aduna un număr întreg direct la o variabilă de tip struct (e1 = e2 + 1 este o operație invalidă în C++).'),
('medium', 'choice', 'Organizarea Datelor', 'Structuri de date (struct)', 'Dacă avem un vector de structuri, cum afișăm numele celui de-al doilea elev?', 'struct Elev { char nume[20]; };\nElev clasa[30];', '["clasa[1].nume","clasa[2].nume","clasa.nume[1]","nume.clasa[2]"]'::jsonb, 0, 'Primul elev e la pozitia 0, al doilea e la pozitia 1. Deci clasa[1] e elevul, iar .nume accesează câmpul lui.'),
('easy', 'code', 'Subprograme', 'Transmitere prin valoare', 'Completează ce cuvânt cheie folosim pentru o funcție care NU trebuie să returneze niciun rezultat înapoi (doar afișează ceva)?', '________ afisareSalut() {\n    cout << "Salut!";\n}', '["int","void","return","bool"]'::jsonb, 1, 'Cuvântul void (care înseamnă "gol" în engleză) se pune înaintea unei funcții care doar execută acțiuni și nu trimite înapoi (return) nicio valoare.'),
('easy', 'choice', 'Subprograme', 'Transmitere prin valoare', 'Care este rezultatul acestei funcții dacă o apelăm cu numar(4)?', 'int numar(int x) {\n    return x + 1;\n}', '["4","5","x","0"]'::jsonb, 1, 'Funcția primește 4, adună 1 și returnează 5.'),
('medium', 'choice', 'Subprograme', 'Transmitere prin valoare', 'Ce se va afișa pe ecran?', 'void modifica(int x) {\n    x = 10;\n}\n\nint main() {\n    int a = 5;\n    modifica(a);\n    cout << a;\n}', '["10","5","0","Eroare"]'::jsonb, 1, 'Când o variabilă e trimisă prin valoare (normal, fără caracterul &), funcția primește doar o clonă (o copie). Deci modificarea lui x în 10 nu îl afectează pe a, care rămâne tot 5 în main.'),
('medium', 'choice', 'Subprograme', 'Transmitere prin valoare', 'Variabilele create în interiorul unei funcții se numesc variabile locale. Ce se întâmplă cu ele la terminarea funcției?', NULL, '["Se sterg din memorie","Raman salvate in calculator pe veci","Pot fi folosite in main","Se salveaza in fisiere"]'::jsonb, 0, 'Variabilele locale trăiesc doar cât timp funcția lucrează. După ce funcția se termină (la acolada de închidere), ele sunt distruse automat.'),
('easy', 'choice', 'Subprograme', 'Transmitere prin referinta', 'Ce simbol folosim în C++ în fața parametrului unei funcții pentru ca modificările să afecteze variabila originală (prin referință)?', 'void schimba(int ___x) {\n	x=x*2;\n}', '["*","#","&","%"]'::jsonb, 2, 'Simbolul & (ampersand) leagă variabila din funcție direct de variabila originală. Astfel, funcția modifică direct originalul.'),
('medium', 'choice', 'Subprograme', 'Transmitere prin referinta', 'Ce se va afișa pe ecran?', 'void swap(int &x, int &y) {\n    int temp = x;\n    x = y;\n    y = temp;\n}\nint main() {\n    int a = 1, b = 2;\n    swap(a, b);\n    cout << a << " " << b;\n}', '["1 2","2 1","0 0","1 1"]'::jsonb, 1, 'Deoarece am folosit referința (&), funcția swap (interschimbare) a inversat direct valorile variabilelor originale a și b. Deci ele devin 2 și 1 (nu 1 și 2).'),
('hard', 'choice', 'Subprograme', 'Recursivitate', 'Ce va afișa pe ecran apelul f(12345) în urma executării codului de mai jos?', 'void f(int n) {\n    if (n!=0) {\n        if (n%2==0) cout<<n%10;\n        f(n/10);\n        if (n%2!=0) cout<<n%10;\n    }\n    else cout<<"-";\n}', '["42-135","42-531","531-42","24-531"]'::jsonb, 0, 'La apelul recursiv (pe coborâre), înainte de auto-apel se afișează cifrele pare (4, apoi 2). Când n ajunge la 0, se afișează caracterul "-". La revenirea din recursivitate (pe urcare), se afișează cifrele impare (1, apoi 3, apoi 5). Astfel, rezultatul concatenat este 42-135.'),
('hard', 'code', 'Subprograme', 'Recursivitate', 'Completează funcția recursivă pentru a calcula factorialul unui număr n. Dacă n este 0, rezultatul este 1.', 'int fact(int n) {\n    if (n == 0) return 1;\n    return n * ________;\n}', '["fact(n)","fact(n-1)","n-1","fact(n+1)"]'::jsonb, 1, 'Pentru a calcula factorialul, înmulțim n cu factorialul numerelor mai mici decât el, deci apelăm funcția cu n-1: fact(n-1).'),
('easy', 'choice', 'Backtracking', 'Teorie si aplicare practica', 'Generând șirurile de exact 2 caractere distincte din mulțimea {A, B, C, D}, ordonate lexicografic (alfabetic), obținem succesiv: AB, AC, AD, BC, ... Ce se va afișa imediat după BD?', NULL, '["CA","CB","CD","Nu se va afișa nimic"]'::jsonb, 2, 'Dupa epuizarea sirurilor care incep cu B (BC, BD), algoritmul trece la litera C. Singura varianta valida este CD.'),
('medium', 'choice', 'Backtracking', 'Teorie si aplicare practica', 'Dacă vrem să generăm toate Permutările mulțimii {1, 2, 3}, câte soluții în total ne va oferi algoritmul de Backtracking?', NULL, '["3 solutii","6 solutii (3!)","9 solutii","1 solutie"]'::jsonb, 1, 'Permutările de n elemente înseamnă toate așezările posibile. Numărul lor este n factorial (3!). 1*2*3 = 6 soluții.'),
('hard', 'choice', 'Backtracking', 'Teorie si aplicare practica', 'Utilizând metoda backtracking, se generează toate numerele de mașină formate din:\n- indicativ județ {B, BR, HD, MM, SV, TL};\n- număr din 2 cifre distincte din {2,4,6,8} în ordine strict crescătoare;\n- 3 litere distincte din {A,B,C} cu mijlocul A.\n\nPrimele 7 generate sunt B-24-BAC, B-24-CAB, B-26-BAC, B-26-CAB, B-28-BAC, B-28-CAB, B-46-BAC. Indicați soluțiile generate imediat înainte, respectiv imediat după SV-68-CAB.', NULL, '["MM-68-CAB, SV-86-BAC","SV-46-CAB, TL-24-BAC","SV-48-BAC, SV-68-BAC","SV-68-BAC, TL-24-BAC"]'::jsonb, 3, 'Numerele se generează lexicografic. Înainte de SV-68-CAB este SV-68-BAC (schimbăm literele). Fiind ultima soluție pentru SV, următoarea trece la județul următor (TL-24-BAC).'),
('hard', 'choice', 'Backtracking', 'Teorie si aplicare practica', 'Utilizând metoda backtracking, s-au generat toate codurile posibile pentru deblocarea unor telefoane, coduri de câte 6 cifre distincte, din mulțimea cifrelor, ordonată crescător. Fiecare cod are primele trei cifre impare și ultimele trei cifre pare. Primele patru coduri sunt 135024, 135026, 135028, 135042. Indicați penultimul cod generat.', NULL, '["957862","957846","975862","975846"]'::jsonb, 2, 'Cel mai mare prefix de cifre impare este 975. Cele mai mari sufixe de cifre pare sunt 862 (penultimul) și 864 (ultimul). Deci penultimul cod este 975862.'),
('easy', 'choice', 'Grafuri si Arbori', 'Terminologie grafuri', 'Din ce sunt formate grafurile neorientate?', NULL, '["Doar din numere si plusuri","Din noduri (puncte) și muchii (linii între puncte)","Din cuvinte asezate in tabel","Din poze"]'::jsonb, 1, 'Un graf matematic este format pur și simplu dintr-o mulțime de puncte (numite Noduri sau Vârfuri) și linii care le unesc, numite Muchii (grafuri neorientate) sau Arce (grafuri orientate).'),
('easy', 'choice', 'Grafuri si Arbori', 'Terminologie grafuri', 'Ce înseamnă că două noduri dintr-un graf sunt "adiacente"?', NULL, '["Sunt vecine, adica au o linie (muchie) directa intre ele","Sunt cele mai indepartate noduri","Au acelasi numar de muchii","Nu au nicio legatura intre ele"]'::jsonb, 0, 'Adiacent înseamnă practic "vecin". Dacă există o linie directă de la un punct la altul, ele sunt adiacente.'),
('medium', 'choice', 'Grafuri si Arbori', 'Terminologie grafuri', 'Ce reprezintă "gradul" unui nod într-un graf neorientat?', NULL, '["Numarul de arce care intră în el.","Numarul pe care il poarta (eticheta)","Numarul de linii (muchii) care se prind de el","Numarul de arce care ies din el."]'::jsonb, 2, 'Gradul înseamnă câți "prieteni" direcți are acel nod. Numărăm pur și simplu câte muchii pornesc/ajung fix în el.'),
('medium', 'choice', 'Grafuri si Arbori', 'Terminologie grafuri', 'Ce este un Graf Complet?', NULL, '["Un graf in care toate muchiile au lungime 10","Un graf desenat perfect patrat","Un graf in care oricare doua noduri au linie intre ele","Un graf din care putem ajunge dintr-un nod în oricare alt nod prin noduri intermediare."]'::jsonb, 2, 'Complet înseamnă că toată lumea e conectată cu toată lumea. Orice pereche de 2 noduri are obligatoriu muchie între ele.'),
('medium', 'choice', 'Grafuri si Arbori', 'Grafuri orientate', 'Într-un graf orientat, liniile au un sens clar (sunt niște săgeți care pleacă din x spre y). Cum se numesc aceste linii?', NULL, '["Muchii","Arce","Linii de forta","Pointeri"]'::jsonb, 1, 'La grafurile neorientate folosim termenul "Muchii". La grafurile orientate (cu săgeți, direcție precisă), le numim "Arce".'),
('hard', 'choice', 'Grafuri si Arbori', 'Grafuri orientate', 'Ce reprezintă gradul intern (d-) al unui nod într-un graf orientat?', NULL, '["Cate sageti ies din acel nod spre altele","Suma tuturor numerelor","Cate sageti intra in acel nod","Gradul inmultit cu 2"]'::jsonb, 2, 'Gradul intern înseamnă numărul de arce (săgeți) care INTRĂ (sosesc) în acel nod dinspre altele.'),
('medium', 'choice', 'Grafuri si Arbori', 'Grafuri neorientate', 'Care este o proprietate de bază a matricei de adiacență pentru un graf neorientat?', NULL, '["Este plina doar de numarul 2","Este simetrică față de diagonala principală","Are doar cifre pare pe colturi","Toate valorile adunate dau un numar prim"]'::jsonb, 1, 'Într-un graf neorientat, dacă nodul 1 are drum la 2, și 2 are drum înapoi la 1. Asta face ca matricea să arate ca o oglindă (simetrică) pe diagonala principală.'),
('hard', 'choice', 'Grafuri si Arbori', 'Grafuri neorientate', 'Suma gradelor tuturor nodurilor dintr-un graf neorientat cu "m" muchii este egală cu:', NULL, '["m!","m / 2","m * m","2 * m "]'::jsonb, 3, 'Fiecare muchie unește exact 2 noduri. Deci ea "adaugă" grad și la un capăt, și la celălalt. Prin urmare, o muchie crește suma totală a gradelor cu 2.'),
('medium', 'choice', 'Grafuri si Arbori', 'Arbori', 'Ce este mai exact un "Arbore" în teoria grafurilor?', NULL, '["Un graf cu o singura muchie","Un graf orientat care are cicluri","Un graf conex care nu are cicluri","Un graf care are n-1 muchii"]'::jsonb, 2, 'Arborele e pur și simplu un graf neorientat, legat complet (conex), dar din care, dacă pleci de la un nod pe muchii, nu poți face un "cerc" ca să te întorci de unde ai plecat (fără cicluri).'),
('hard', 'choice', 'Grafuri si Arbori', 'Arbori', 'Câte muchii are garantat un Arbore format din "n" noduri?', NULL, '["n","n + 1","n - 1","n * 2"]'::jsonb, 2, 'Regula de bază spune că orice arbore are cu exact o muchie mai puțin decât numărul lui de noduri. Dacă are 10 puncte, are 9 linii de legătură (n - 1).'),
('medium', 'code', 'Fundamente', 'Operatori si expresii', 'Analizează secvența de cod C++ de mai jos care folosește operatorii pe biți (bitwise). Ce valoare va fi afișată pe ecran în urma executării acestei instrucțiuni?', 'int a = 12; // 1100 în binar
int b = 10; // 1010 în binar
int c = (a & b) | (a ^ b);
cout << c;', '["10","12","14","8"]'::jsonb, 2, 'Expresia (a & b) reprezintă AND pe biți (8, binar 1000), iar (a ^ b) este XOR pe biți (6, binar 0110). Operarea OR (8 | 6) reconstituie binar 1110 adică valoarea 14... Stai: 12 & 10 = 8 (1000). 12 ^ 10 = 6 (0110). 8 | 6 = 14 (1110), deci rezultatul exact este 14.'),
('medium', 'choice', 'Fundamente', 'Operatori si expresii', 'Care dintre următoarele expresii C++ verifică dacă o variabilă întreagă x aparține intervalului închis [10, 50] și este totodată un număr divizibil cu 3 sau cu 5?', NULL, '["(x >= 10 && x <= 50) && (x % 3 == 0 || x % 5 == 0)","(x > 10 || x < 50) && (x % 3 == 0 && x % 5 == 0)","x >= 10 || x <= 50 || x % 15 == 0","(x >= 10 && x <= 50) || (x % 3 == 0 || x % 5 == 0)"]'::jsonb, 0, 'Prima parte (x >= 10 && x <= 50) garantează că x se află în intervalul închis [10, 50]. A doua parte (x % 3 == 0 || x % 5 == 0) verifică divizibilitatea cu 3 sau 5, legate prin operatorul logic AND (&&).');

INSERT INTO questions (difficulty, type, category, subcategory, exam_type, text, image_url, code, options_json, correct_index, explanation) VALUES ('medium', 'code', 'Organizarea Datelor', 'Vectori', 'Initial', 'Se consideră un vector v cu 6 elemente întregi. Ce valoare va avea v[3] după executarea secvenței de cod de mai jos?', NULL, 'int v[6] = {2, 4, 6, 8, 10, 12};
for (int i = 0; i < 5; i++) {
    v[i] = v[i+1] - v[i];
}', '["2","4","6","0"]'::jsonb, 0, 'Executăm pas cu pas:\ni=0: v[0] = 4 - 2 = 2\ni=1: v[1] = 6 - 4 = 2\ni=2: v[2] = 8 - 6 = 2\ni=3: v[3] = v[4] - v[3] = 10 - 8 = 2.\nValoarea lui v[3] devine 2.');

INSERT INTO questions (difficulty, type, category, subcategory, exam_type, text, image_url, code, options_json, correct_index, explanation) VALUES ('medium', 'choice', 'Organizarea Datelor', 'Structuri de date (struct)', 'Initial', 'Considerăm următoarea definire a unei structuri în C++. Cum se declară un tablou de 100 de puncte și cum se accesează coordonata x a celui de-al treilea punct (indexat de la 0)?', NULL, 'struct Punct {
    double x, y;
};', '["Punct p[100]; p[2].x","Punct p(100); p(3).x","struct Punct p[100]; p[3]->x","Punct p[100]; p.x[2]"]'::jsonb, 0, 'Tabloul de structuri se declară ca `Punct p[100];`. Accesarea celui de-al treilea element se face prin indexul 2 (`p[2]`), iar câmpul x prin operatorul punct (`.x`), rezultând `p[2].x`.');

INSERT INTO questions (difficulty, type, category, subcategory, exam_type, text, image_url, code, options_json, correct_index, explanation) VALUES ('medium', 'code', 'Subprograme', 'Transmitere prin valoare', 'Initial', 'Ce valoare va afișa funcția main în urma executării codului C++ de mai jos?', NULL, 'void f(int x, int y) {
    x = x + y;
    y = x - y;
}
int main() {
    int a = 5, b = 3;
    f(a, b);
    cout << a << " " << b;
}', '["5 3","8 5","8 3","5 8"]'::jsonb, 0, 'Parametrii x și y sunt reduși la transmitere prin valoare (copie locală). Orice reatribuire sau operare aritmetică în interiorul funcției f nu modifică variabilele originale a și b din funcția main. Deci a și b rămân 5 și 3.');

INSERT INTO questions (difficulty, type, category, subcategory, exam_type, text, image_url, code, options_json, correct_index, explanation) VALUES ('hard', 'code', 'Subprograme', 'Transmitere prin referinta', 'Initial', 'Ce valoare va avea variabila x în main după apelul funcției de mai jos care combină transmiterea prin valoare și prin referință?', NULL, 'void calcul(int a, int &b) {
    a = a * 2;
    b = a + b;
}
int main() {
    int x = 4, y = 10;
    calcul(x, y);
    cout << x << " " << y;
}', '["4 18","8 18","8 10","4 10"]'::jsonb, 0, 'Parametrul a este transmis prin valoare (a primind o copie a lui x = 4, apoi devine 8). Parametrul b este transmis prin referință (&b este legat direct de y). În funcție: b = 8 + 10 = 18. Variabila x rămâne nemodificată (4), iar y devine 18. Afișarea este "4 18".');

INSERT INTO questions (difficulty, type, category, subcategory, exam_type, text, image_url, code, options_json, correct_index, explanation) VALUES ('medium', 'choice', 'Fundamente', 'Structuri de control', 'Admitere', 'Algoritmul alăturat este reprezentat în pseudocod. S-a notat cu x%y restul împărțirii numărului natural x la numărul natural nenul y și cu [z] partea întreagă a numărului real z. Indicați valoarea afișată în urma executării algoritmului, dacă se citesc în această ordine numerele: 4, 92, 718, 14, 21354.', NULL, 'citește n (n număr natural nenul)
m ← 0
┌ pentru i ← 1, n execută
|   citește a (număr natural)
|   s ← 0
|   ┌ cât timp a > 0 execută
|   |   s ← s + a % 10
|   |   a ← [a / 100]
|   └
|   ┌ dacă s > m atunci
|   |   m ← s
|   └
└
scrie m', '["15","47","21354","16"]'::jsonb, 0, 'Algoritmul determină suma cifrelor de pe pozițiile impare (de la dreapta la stânga) ale fiecărui număr citit și afișează valoarea maximă m. Pentru 92 suma este 2; pentru 718 este 8+7=15; pentru 14 este 4; pentru 21354 este 4+3+2=9. Maximul obținut este 15 (opțiunea A).');

INSERT INTO questions (difficulty, type, category, subcategory, exam_type, text, image_url, code, options_json, correct_index, explanation) VALUES ('medium', 'choice', 'Organizarea Datelor', 'Vectori', 'Admitere', 'Fie a un tablou unidimensional cu 6 elemente de tip întreg ce conține elementele (4, 3, 7, 0, 1, 2) memorate începând cu poziția 1. Indicați varianta care precizează conținutul tabloului după executarea secvenței de instrucțiuni de mai jos.', NULL, 'for(i=1; i<=n; i++)
    if(a[i]%2==0)
        a[i]=2*a[i]+1;
    else
        a[i]=a[i]-1;', '["(9, 7, 15, 1, 3, 5)","(9, 2, 6, 1, 0, 5)","(3, 7, 15, 1, 0, 1)","(3, 2, 6, 0, 1, 5)"]'::jsonb, 1, 'Parcurgem elementele:
a[1]=4 (par) -> 2*4+1 = 9
a[2]=3 (impar) -> 3-1 = 2
a[3]=7 (impar) -> 7-1 = 6
a[4]=0 (par) -> 2*0+1 = 1
a[5]=1 (impar) -> 1-1 = 0
a[6]=2 (par) -> 2*2+1 = 5
Rezultatul este (9, 2, 6, 1, 0, 5) - opțiunea B.');

INSERT INTO questions (difficulty, type, category, subcategory, exam_type, text, image_url, code, options_json, correct_index, explanation) VALUES ('hard', 'choice', 'Grafuri si Arbori', 'Grafuri neorientate', 'Admitere', 'Un graf neorientat are 10 noduri și fiecare nod are gradul 2. Indicați numărul maxim de componente conexe ale acestui graf.', NULL, NULL, '["2","1","4","3"]'::jsonb, 3, 'Un graf neorientat simplu în care fiecare nod are gradul 2 este o reuniune de cicluri disjuncte. Pentru a maximiza numărul de componente conexe (cicluri), fiecare ciclu trebuie să aibă dimensiunea minimă posibilă, adică 3 noduri. Cu 10 noduri, putem avea cel mult două cicluri de 3 noduri și un ciclu de 4 noduri (3+3+4 = 10 noduri). Numărul maxim de componente conexe este 3 (opțiunea D).');

INSERT INTO questions (difficulty, type, category, subcategory, exam_type, text, image_url, code, options_json, correct_index, explanation) VALUES ('medium', 'choice', 'Subprograme', 'Recursivitate', 'Admitere', 'Subprogramul f este definit mai jos. Indicați valoarea returnată în urma apelului f(6, 1).', NULL, 'int f(int n, int d)
{
    if (d>=n)
        return 0;
    else
        if (n%d==0)
            return d+f(n, d+1);
        else
            return f(n, d+1);
}', '["5","6","12","0"]'::jsonb, 1, 'Funcția f(n, d) însumează toți divizorii proprii ai lui n începând cu d. Pentru n=6 și d=1: divizorii mai mici decât 6 sunt 1, 2 și 3. Suma lor este 1 + 2 + 3 = 6 (opțiunea B).');

INSERT INTO questions (difficulty, type, category, subcategory, exam_type, text, image_url, code, options_json, correct_index, explanation) VALUES ('medium', 'choice', 'Organizarea Datelor', 'Structuri de date (struct)', 'Admitere', 'Variabila d declarată mai jos memorează data expirării unui produs. Indicați expresia adevărată dacă și numai dacă produsul expiră în 21 iulie 2026.', NULL, 'struct data
{
    int zi, luna, an;
} d;', '["zi.d==21 && luna.d==7 && an.d==2026","d.zi==21 && d.luna==7 && d.an==2026","d.zi==21 || d.luna==7 || d.an==2026","zi.d==21 || luna.d==7 || an.d==2026"]'::jsonb, 1, 'Accesarea câmpurilor unei structuri se face prin sintaxa d.zi, d.luna, d.an. Condiția ca toate cele 3 componente să aibă valorile specificate simultan necesită operatorul logic de conjuncție (&&). Expresia corectă este d.zi==21 && d.luna==7 && d.an==2026 (opțiunea B).');

INSERT INTO questions (difficulty, type, category, subcategory, exam_type, text, image_url, code, options_json, correct_index, explanation) VALUES ('medium', 'choice', 'Organizarea Datelor', 'Vectori', 'Admitere', 'Fie tablourile unidimensionale x=(24, 31, 45, 50) și y=(29, 34, 55, 76). Se aplică metoda interclasării în ordine crescătoare pe tablourile obținute prin înlocuirea fiecărui element cu suma cifrelor sale. Identificați tabloul obținut.', NULL, NULL, '["(7, 10, 11, 13, 4, 5, 6, 9)","(4, 5, 6, 9, 7, 10, 11, 13)","(4, 5, 6, 7, 9, 10, 11, 13)","(6, 4, 9, 5, 11, 7, 10, 13)"]'::jsonb, 2, 'Sumele cifrelor pentru tabloul x sunt: (6, 4, 9, 5). Sumele cifrelor pentru tabloul y sunt: (11, 7, 10, 13). Interclasarea în ordine crescătoare a tuturor acestor valori obține sirul ordonat: (4, 5, 6, 7, 9, 10, 11, 13) - opțiunea C.');

INSERT INTO questions (difficulty, type, category, subcategory, exam_type, text, image_url, code, options_json, correct_index, explanation) VALUES ('hard', 'choice', 'Fundamente', 'Operatori si expresii', 'Admitere', 'În secvența de instrucțiuni de mai jos x este o variabilă de tip real și y este o variabilă de tip întreg. Indicați valoarea variabilei z obținută în urma executării secvenței.', NULL, 'x=3.527; y=5; z=floor(sqrt(y))-(int)(x*100)/100;', '["0","5","6","-1"]'::jsonb, 3, 'sqrt(5) ≈ 2.236, iar floor(2.236) este 2. (int)(x*100) devine (int)(352.7) = 352. Împărțirea (int)(x*100)/100 este întreagă (352 / 100 = 3). Prin urmare, z = 2 - 3 = -1 (opțiunea D).');

INSERT INTO questions (difficulty, type, category, subcategory, exam_type, text, image_url, code, options_json, correct_index, explanation) VALUES ('easy', 'choice', 'Fundamente', 'Operatori si expresii', 'Admitere', 'Variabila nenulă x este de tip întreg și divizibilă cu 10. Indicați expresia adevărată.', NULL, NULL, '["x/2 + x/5 == 0","x*10/10%2 + x*10/10%5 != x%10","x%2 * x%5 != x%10","x%2 + x%5 == x%10"]'::jsonb, 3, 'Deoarece x este divizibil cu 10, x este divizibil și cu 2 și cu 5. Prin urmare: x % 2 == 0, x % 5 == 0 și x % 10 == 0. Înlocuind în opțiunea D: 0 + 0 == 0, ceea ce este o egalitate adevărată (opțiunea D).');

INSERT INTO questions (difficulty, type, category, subcategory, exam_type, text, image_url, code, options_json, correct_index, explanation) VALUES ('medium', 'choice', 'Grafuri si Arbori', 'Grafuri orientate', 'Initial', 'Ce este un graf tare conex (sau o componentă tare conexă)?', NULL, NULL, '["Un graf orientat în care pentru orice pereche de noduri (u, v) există drum de la u la v și drum de la v la u","Un graf neorientat fără cicluri","Un graf orientat în care toate nodurile au același grad","Un graf cu matrice de adiacență simetrică"]'::jsonb, 0, 'Tare conexitatea se aplică grafurilor orientate și înseamnă că între oricare două noduri u și v există drum orientat atât de la u la v cât și de la v la u.');

INSERT INTO questions (difficulty, type, category, subcategory, exam_type, text, image_url, code, options_json, correct_index, explanation) VALUES ('hard', 'choice', 'Grafuri si Arbori', 'Terminologie grafuri', 'Initial', 'Ce reprezintă un "Ciclul Eulerian" într-un graf neorientat conex?', NULL, NULL, '["Un ciclu care conține fiecare MUCHIE a grafului exact o singură dată","Un ciclu care conține fiecare NOD al grafului exact o singură dată","Un arbore de acoperire minimă","Drumul cel mai scurt între două noduri"]'::jsonb, 0, 'Un ciclu Eulerian parcurge fiecare MUCHIE a grafului o singură dată și se întoarce la nodul de start. Condiția necesară și suficientă este ca toate nodurile să aibă grad par.');

INSERT INTO questions (difficulty, type, category, subcategory, exam_type, text, image_url, code, options_json, correct_index, explanation) VALUES ('hard', 'choice', 'Grafuri si Arbori', 'Terminologie grafuri', 'Initial', 'Ce reprezintă un "Ciclul Hamiltonian" într-un graf?', NULL, NULL, '["Un ciclu care trece prin fiecare NOD al grafului exact o singură dată","Un ciclu care trece prin fiecare muchie o singură dată","Un ciclu de lungime minimă egală cu 3","Un drum care unește doar frunzele"]'::jsonb, 0, 'Un ciclu Hamiltonian este un ciclu simplu care trece prin fiecare NOD (vârf) al grafului exact o singură dată și revine la nodul inițial.');

INSERT INTO questions (difficulty, type, category, subcategory, exam_type, text, image_url, code, options_json, correct_index, explanation) VALUES ('medium', 'code', 'Subprograme', 'Transmitere prin valoare', 'Admitere', 'Se consideră subprogramul f, de mai jos. Indicați ce se afișează în urma apelului acestuia, dacă v = {5, 1, 8, 4} și n = 4?', NULL, 'void f(int v[], int n) {
    int i, j;
    int maxVal, poz;
    for (i = 0; i < n; i++) {
        maxVal = -1;
        j = 0;
        while (j < n) {
            if (v[j] > maxVal) {
                maxVal = v[j];
                poz = j;
            }
            j++;
        }
        printf("%d ", maxVal);
        v[poz] = -1;
    }
}', '["1 4 5 8","8 5 4 1","8 4 5 1","5 8 4 1"]'::jsonb, 1, 'La prima parcurgere se determină maximul 8 de pe poziția 2, se afișează 8 și v[2] devine -1. La a doua parcurgere se determină 5 de pe poziția 0, se afișează 5 și v[0] devine -1. Urmează 4 de pe poziția 3 și în final 1 de pe poziția 1. Rezultatul afișat este 8 5 4 1.');

INSERT INTO questions (difficulty, type, category, subcategory, exam_type, text, image_url, code, options_json, correct_index, explanation) VALUES ('easy', 'code', 'Fundamente', 'Structuri de control', 'Admitere', 'Indicați ce se afișează pe ecran în urma execuției secvenței de program următoare.', NULL, 'void count(int value) {
    int res = 0;
    while (value > 0) {
        if ((value % 10) % 2)
            res += value % 10;
        value = value / 10;
    }
    cout << res << " ";
}
int main() {
    count(4872319);
    return 0;
}', '["16","18","20","19"]'::jsonb, 2, 'Subprogramul adună în variabila res doar cifrele impare ale numărului primit ca parametru ((value % 10) % 2 este adevărat pentru cifre impare). Cifrele impare ale lui 4872319 sunt 9, 1, 3 și 7. Suma lor este 9 + 1 + 3 + 7 = 20.');

INSERT INTO questions (difficulty, type, category, subcategory, exam_type, text, image_url, code, options_json, correct_index, explanation) VALUES ('medium', 'code', 'Organizarea Datelor', 'Matrice', 'Admitere', 'Indicați valoarea variabilei sum, după execuția următoarei secvențe de cod.', NULL, 'int matrix[9][9] = { 0 };
int i, j, n = 9;
int sum = 0;

for (i = 0; i < n; i++) {
    matrix[i][n - i - 1] = 1;
    matrix[i][i] = -1;
}

for (i = 0; i < n; i++) {
    for (j = 0; j < n; j++) {
        sum += matrix[i][j];
    }
}', '["1","0","-1","18"]'::jsonb, 2, 'În primul for, diagonala secundară este setată pe 1 (9 elemente), iar diagonala principală este setată pe -1 (9 elemente). Elementul central matrix[4][4] aparține ambelor diagonale, fiind inițial setat pe 1 și apoi suprascris cu -1. Astfel, rămân 8 elemente egale cu 1 și 9 elemente egale cu -1. Suma elementelor este 8 * 1 + 9 * (-1) = 8 - 9 = -1.');

INSERT INTO questions (difficulty, type, category, subcategory, exam_type, text, image_url, code, options_json, correct_index, explanation) VALUES ('medium', 'code', 'Subprograme', 'Recursivitate', 'Admitere', 'Indicați ce se afișează pe ecran în urma execuției programului de mai jos.', NULL, '#include <iostream>
using namespace std;
void fun(char s[], int index) {
    if (s[index] == ''\0'')
        return;
    cout << s[index];
    fun(s, index + 3);
}
int main() {
    char str[20] = "Admitere ATM";
    fun(str, 0);
    return 0;
}', '["AirA","AmrT","Admitere ATM","AmtrAM"]'::jsonb, 0, 'Funcția recursivă afișează caracterul de pe poziția curentă index și se apelează din 3 în 3 poziții: poziția 0 (''A''), poziția 3 (''i''), poziția 6 (''r''), poziția 9 (''A''). La poziția 12 se găsește caracterul nul ''\0'' și recursivitatea se oprește. Şirul afișat este AirA.');

INSERT INTO questions (difficulty, type, category, subcategory, exam_type, text, image_url, code, options_json, correct_index, explanation) VALUES ('medium', 'code', 'Subprograme', 'Transmitere prin valoare', 'Admitere', 'Se consideră subprogramul f, de mai jos. Indicați ce se afișează în urma apelului acestuia, dacă v = {5, 1, 8, 4} și n = 4?', NULL, 'void f(int v[], int n) {
    int i, j;
    int maxVal, poz;
    for (i = 0; i < n; i++) {
        maxVal = -1;
        j = 0;
        while (j < n) {
            if (v[j] > maxVal) {
                maxVal = v[j];
                poz = j;
            }
            j++;
        }
        cout << maxVal << " ";
        v[poz] = -1;
    }
}', '["1 4 5 8","8 5 4 1","8 4 5 1","5 8 4 1"]'::jsonb, 1, 'La prima parcurgere se determină maximul 8 de pe poziția 2, se afișează 8 și v[2] devine -1. La a doua parcurgere se determină 5 de pe poziția 0, se afișează 5 și v[0] devine -1. Urmează 4 de pe poziția 3 și în final 1 de pe poziția 1. Rezultatul afișat este 8 5 4 1.');

INSERT INTO questions (difficulty, type, category, subcategory, exam_type, text, image_url, code, options_json, correct_index, explanation) VALUES ('hard', 'choice', 'Grafuri si Arbori', 'Grafuri neorientate', 'Admitere', 'Fie graful neorientat complet G, cu noduri notate de la 1 la 10 inclusiv. Se dorește eliminarea succesivă a muchiilor, astfel încât graful G să fie conex și să conțină exact un ciclu elementar. Câte muchii trebuie să fie eliminate?', NULL, NULL, '["0","35","1","26"]'::jsonb, 1, 'Un graf complet cu 10 noduri are n*(n-1)/2 = 45 de muchii. Un graf conex cu n noduri ce conține exact un ciclu (graf uniciclic) are exact n = 10 muchii. Numărul de muchii ce trebuie eliminate este 45 - 10 = 35.');

INSERT INTO questions (difficulty, type, category, subcategory, exam_type, text, image_url, code, options_json, correct_index, explanation) VALUES ('medium', 'code', 'Subprograme', 'Recursivitate', 'Admitere', 'Se consideră funcția f definită mai jos. Ce se va afișa în urma apelului f(578)?', NULL, '#include <iostream>
using namespace std;

int f(int n) {
    if (n < 10)
        return 1;
    else
        return 2 * (n % 10) + f(n / 10);
}

int main() {
    cout << f(578);
    return 0;
}', '["16","31","15","30"]'::jsonb, 1, 'Pentru n=578, f(578) returnează 2*8 + f(57) = 16 + f(57). Apoi f(57) returnează 2*7 + f(5) = 14 + f(5). La final, pentru n=5, 5 < 10, deci f(5) returnează 1. Adunând tot: 16 + 14 + 1 = 31.');

INSERT INTO questions (difficulty, type, category, subcategory, exam_type, text, image_url, code, options_json, correct_index, explanation) VALUES ('medium', 'choice', 'Algoritmi Elementari', 'Cautare', 'Admitere', 'Pentru a verifica dacă în tabloul unidimensional (25, 20, 18, 11, 9, 6, 3) există elementul x=18, se aplică metoda căutării binare. Succesiunea de elemente a căror valoare se compară cu x pe parcursul aplicării metodei este:', NULL, NULL, '["11, 6, 18","25, 20, 18","11, 20, 18","11, 9, 18"]'::jsonb, 2, 'Tabloul este sortat descrescător. Se determină mijlocul: (0+6)/2 = 3. Elementul din mijloc este 11. Deoarece 18 > 11, căutăm în jumătatea stângă. Noul interval: (0+2)/2 = 1. Elementul este 20. Cum 18 < 20, căutăm în dreapta. Noul interval: (2+2)/2 = 2. Elementul este 18, pe care l-am găsit. Comparațiile au fost: 11, 20, 18.');

INSERT INTO questions (difficulty, type, category, subcategory, exam_type, text, image_url, code, options_json, correct_index, explanation) VALUES ('medium', 'choice', 'Grafuri si Arbori', 'Arbori', 'Admitere', 'Se consideră un graf neorientat complet cu 15 vârfuri. Indicați numărul de muchii care trebuie eliminate astfel încât graful rezultat să fie arbore.', NULL, NULL, '["105","91","14","17"]'::jsonb, 1, 'Un graf complet cu 15 vârfuri are n*(n-1)/2 = 15*14/2 = 105 muchii. Un arbore cu 15 vârfuri trebuie să aibă exact n-1 = 14 muchii. Prin urmare, trebuie eliminate 105 - 14 = 91 de muchii.');

INSERT INTO questions (difficulty, type, category, subcategory, exam_type, text, image_url, code, options_json, correct_index, explanation) VALUES ('easy', 'code', 'Organizarea Datelor', 'Structuri', 'Admitere', 'Se consideră declararea de mai jos. Indicați instrucțiunea care calculează aria dreptunghiului.', NULL, 'struct dreptunghi {
    int lung, lat, arie;
} d;', '["d.arie = d.lung * d.lat;","arie.d = lung.d * lat.d;","arie = lung * lat;","d.arie = d.(lung * lat);"]'::jsonb, 0, 'Accesarea câmpurilor unei structuri se face prin operatorul punct (.). Variabila structurii este `d`, deci lungimea este `d.lung`, lățimea este `d.lat`, iar aria este `d.arie`. Instrucțiunea corectă este `d.arie = d.lung * d.lat;`.');

INSERT INTO questions (difficulty, type, category, subcategory, exam_type, text, image_url, code, options_json, correct_index, explanation) VALUES ('medium', 'code', 'Algoritmi Elementari', 'Cifrele unui numar', 'Admitere', 'Se consideră următorul algoritm scris în pseudocod. Indicați valorile afișate, dacă pentru variabila n se citește valoarea 27836.', NULL, 'citește n (n număr natural nenul)
max <- -1
min <- 10
┌ cât timp n≠0 execută
│   cif <- n % 10
│   ┌ dacă max < cif și cif % 2 = 0 atunci
│   │   max <- cif
│   └■
│   ┌ dacă min > cif și cif % 2 ≠ 0 atunci
│   │   min <- cif
│   └■
│   n <- [n/10]
└■
scrie min, '' '', max', '["6 3","7 8","2 7","3 8"]'::jsonb, 3, 'Algoritmul determină cifra maximă pară (max) și cifra minimă impară (min) din numărul citit. Pentru 27836, cifrele sunt 2, 7, 8, 3, 6. Cifrele pare sunt 6, 8, 2, deci max va fi 8. Cifrele impare sunt 3, 7, deci min va fi 3. La final se afișează 3 8.');

INSERT INTO questions (difficulty, type, category, subcategory, exam_type, text, image_url, code, options_json, correct_index, explanation) VALUES ('easy', 'choice', 'Fundamente', 'Expresii logice', 'Admitere', 'Variabilele a, b și x sunt reale, iar a <= b. Indicați expresia C/C++ care are valoarea 1 (true) dacă și numai dacă valoarea variabilei x aparține intervalului închis determinat de valorile variabilelor a și b.', NULL, NULL, '["x > a && x < b","x < a || x < b","!(x < a || x > b)","x <= a || x >= b"]'::jsonb, 2, 'Intervalul închis [a, b] se traduce matematic ca a <= x și x <= b (adică x >= a && x <= b). Conform legilor lui De Morgan, negarea disjuncției complementelor dă aceeași expresie: !(x < a || x > b) este echivalent cu (x >= a && x <= b).');

INSERT INTO questions (difficulty, type, category, subcategory, exam_type, text, image_url, code, options_json, correct_index, explanation) VALUES ('hard', 'choice', 'Subprograme', 'Backtracking', 'Admitere', 'Utilizând metoda backtracking sunt generate numere de 4 cifre având următoarele proprietăți: toate cifrele sunt distincte, iar cifrele aflate pe poziții consecutive sunt de paritate diferită. Primele 5 soluții generate în ordine, sunt: 1032, 1034, 1036, 1038, 1052. Indicați soluția generată imediat după 3458.', NULL, NULL, '["3610","3501","3470","3459"]'::jsonb, 2, 'Avem numărul 3458, cu structura impar-par-impar-par. Următorul număr trebuie să înceapă cu 34 (nu mai sunt cifre pare distincte mai mari ca 8, deci nu putem crește ultima cifră păstrând prefixul 345). Trebuie să creștem a 3-a cifră: următoarea cifră impară după 5 este 7. Apoi punem cea mai mică cifră pară disponibilă pe a 4-a poziție, care este 0. Obținem astfel soluția 3470.');

INSERT INTO questions (difficulty, type, category, subcategory, exam_type, text, image_url, code, options_json, correct_index, explanation) VALUES ('medium', 'choice', 'Fundamente', 'Expresii C/C++', 'BAC', 'Variabilele x și y sunt întregi. Indicați o expresie C/C++ care are valoarea 1 dacă și numai dacă numerele naturale memorate în variabilele x și y au aceeași paritate.', NULL, NULL, '["(x*y)%2==0","x%2==0 && y%2==0","(x+y)%2==0","!(x%2==y%2)"]'::jsonb, 2, 'Două numere au aceeași paritate dacă sunt ambele pare sau ambele impare. În ambele cazuri, suma lor (x+y) va fi un număr par, deci restul împărțirii la 2 va fi 0. Expresia (x+y)%2==0 verifică exact acest lucru.');

INSERT INTO questions (difficulty, type, category, subcategory, exam_type, text, image_url, code, options_json, correct_index, explanation) VALUES ('easy', 'code', 'Organizarea Datelor', 'Structuri', 'BAC', 'Variabila p, declarată alăturat, memorează primul termen și rația unei progresii aritmetice. Știind că diferența dintre un termen al progresiei și termenul anterior este egală cu rația, indicați expresia a cărei valoare este egală cu cel de-al 10-lea termen al progresiei.', NULL, 'struct progresie {
    int prim;
    int ratie;
} p;', '["prim.p+ratie.p*9","p.prim+9*p.ratie","progresie.prim.p+9*progresie.ratie.p","p.progresie.prim+9*p.progresie.ratie"]'::jsonb, 1, 'Formula termenului general dintr-o progresie aritmetică este a_n = a_1 + (n-1)*r. Astfel, al 10-lea termen este a_10 = a_1 + 9*r. Membrii structurii se accesează folosind numele variabilei (p) urmat de punct și numele câmpului. Expresia corectă este p.prim + 9 * p.ratie.');

INSERT INTO questions (difficulty, type, category, subcategory, exam_type, text, image_url, code, options_json, correct_index, explanation) VALUES ('medium', 'choice', 'Grafuri si Arbori', 'Grafuri orientate', 'BAC', 'Un graf orientat cu 5 vârfuri, numerotate de la 1 la 5, este reprezentat prin matricea de adiacență de mai jos. Indicați numărul de vârfuri ale grafului cu proprietatea că valoarea absolută a diferenței gradelor intern și extern este 1.

0 1 0 0 1
1 0 0 0 0
1 1 0 1 0
0 0 1 0 1
0 0 1 1 0', NULL, NULL, '["2","3","4","5"]'::jsonb, 0, 'Gradul extern (nr. de 1 pe linie) și intern (nr. de 1 pe coloană) pentru fiecare vârf sunt: v1 (ext=2, int=2), v2 (ext=1, int=2), v3 (ext=3, int=2), v4 (ext=2, int=2), v5 (ext=2, int=2). Vârfurile la care diferența absolută este 1 sunt v2 (|1-2|=1) și v3 (|3-2|=1). În total sunt 2 vârfuri.');

INSERT INTO questions (difficulty, type, category, subcategory, exam_type, text, image_url, code, options_json, correct_index, explanation) VALUES ('hard', 'choice', 'Grafuri si Arbori', 'Grafuri neorientate', 'BAC', 'Un graf neorientat cu 6 noduri, numerotate de la 1 la 6, este reprezentat astfel: nodurile 1, 2, 3 formează un triunghi (muchiile 1-2, 2-3, 3-1), iar din nodul 3 continuă un lanț 3-6-5-4 (muchiile 3-6, 6-5, 5-4). Indicați numărul maxim de muchii care pot fi adăugate, astfel încât graful obținut să fie eulerian.', NULL, NULL, '["9","6","3","2"]'::jsonb, 1, 'Graful curent are 6 muchii. Pentru ca un graf să fie eulerian, toate vârfurile trebuie să aibă grad par. Gradul maxim par într-un graf cu 6 noduri este 4. Dacă toate cele 6 noduri au gradul 4, numărul total de muchii este 6*4/2 = 12. Astfel, numărul maxim de muchii ce poate fi atins este 12. Întrucât graful are deja 6 muchii, putem adăuga maxim 12 - 6 = 6 muchii.');

INSERT INTO questions (difficulty, type, category, subcategory, exam_type, text, image_url, code, options_json, correct_index, explanation) VALUES ('medium', 'choice', 'Fundamente', 'Expresii C/C++', 'BAC', 'Indicați o expresie C/C++ cu valoarea 1.', NULL, NULL, '["!(2>3 || 3>4)","!(2>3) && 3>4","2>3 && !(3>4)","4>3>2"]'::jsonb, 0, 'Expresia (2>3) este falsă (0), iar (3>4) este tot falsă (0). Disjuncția lor 0 || 0 dă 0 (fals). Negând acest rezultat cu operatorul ''!'', obținem !0, adică 1 (adevărat).');

INSERT INTO questions (difficulty, type, category, subcategory, exam_type, text, image_url, code, options_json, correct_index, explanation) VALUES ('easy', 'code', 'Organizarea Datelor', 'Structuri', 'BAC', 'În muzica clasică, o sonată este o lucrare compusă din trei părți. Variabila declarată alăturat memorează indicativul unei sonate și durata fiecăreia dintre cele trei părți ale acesteia, exprimată în minute și secunde. Indicați o expresie a cărei valoare este egală cu durata celei de a doua părți a sonatei, exprimată în secunde.', NULL, 'struct sonata {
    int indicativ;
    struct {
        int min, sec;
    } unu, doi, trei;
} s;', '["s.doi.sec+60*s.doi.min","sonata.doi.sec+60*sonata.doi.min","sec.doi.s+60*min.doi.s","doi.sec.sonata.s+60*doi.min.sonata.s"]'::jsonb, 0, 'Variabila se numește `s`. Partea a doua se accesează prin `s.doi`. Minutele și secundele acesteia sunt `s.doi.min` și `s.doi.sec`. Durata totală în secunde se calculează înmulțind minutele cu 60 și adunând secundele.');

INSERT INTO questions (difficulty, type, category, subcategory, exam_type, text, image_url, code, options_json, correct_index, explanation) VALUES ('medium', 'choice', 'Grafuri si Arbori', 'Arbori', 'BAC', 'Într-un arbore cu rădăcină considerăm că un nod se află pe nivelul x dacă lanțul elementar care are o extremitate în nodul respectiv și cealaltă extremitate în rădăcina arborelui are lungimea x. Pe nivelul 0 se află un singur nod (rădăcina). Un arbore cu 8 noduri, numerotate de la 1 la 8, este reprezentat prin vectorul de tați: (3, 4, 0, 3, 4, 8, 2, 3). Indicați numărul de niveluri ale arborelui.', NULL, NULL, '["7","5","4","2"]'::jsonb, 2, 'Rădăcina (tatăl 0) este nodul 3 (nivel 0). Fiii lui 3 sunt 1, 4, 8 (nivel 1). Fiii nodurilor 1, 4, 8 sunt 2 și 5 (fiii lui 4) și 6 (fiul lui 8) -> nivel 2. Fiii nodurilor 2, 5, 6 sunt 7 (fiul lui 2) -> nivel 3. Nodul 7 nu are fii. Avem nivelele 0, 1, 2, 3, așadar un număr total de 4 niveluri.');

INSERT INTO questions (difficulty, type, category, subcategory, exam_type, text, image_url, code, options_json, correct_index, explanation) VALUES ('hard', 'choice', 'Grafuri si Arbori', 'Grafuri orientate', 'BAC', 'Un graf orientat cu 7 vârfuri, numerotate de la 1 la 7, are arcele (1,2), (2,3), (3,1), (4,5), (4,6), (5,6), (6,7), (7,4). Indicați numărul minim de arce care pot fi adăugate și poziționate adecvat, astfel încât graful orientat obținut să fie tare conex.', NULL, NULL, '["1","2","3","4"]'::jsonb, 1, 'Graful are două componente tare conexe disjuncte: C1 formată din nodurile {1, 2, 3} (care formează un ciclu 1->2->3->1) și C2 formată din nodurile {4, 5, 6, 7} (ciclu 4->5->6->7->4 și un arc adițional 4->6). Pentru a uni cele două componente într-una singură tare conexă, avem nevoie de minim 2 arce (unul de la C1 la C2 și unul de la C2 la C1).');

INSERT INTO questions (difficulty, type, category, subcategory, exam_type, text, image_url, code, options_json, correct_index, explanation) VALUES ('easy', 'choice', 'Fundamente', 'Expresii C/C++', 'BAC', 'Indicați expresia C/C++ a cărei valoare este egală cu 26.', NULL, NULL, '["(2026-26)/100","2026/100","(2026-26)%100","2026%100"]'::jsonb, 3, 'Operatorul % reprezintă restul împărțirii întregi (modulo). Împărțind 2026 la 100 obținem câtul 20 și restul 26. Așadar, 2026 % 100 are valoarea 26.');

INSERT INTO questions (difficulty, type, category, subcategory, exam_type, text, image_url, code, options_json, correct_index, explanation) VALUES ('medium', 'code', 'Subprograme', 'Recursivitate', 'BAC', 'Subprogramul f este definit alăturat. Indicați valoarea f(1, 10).', NULL, 'int f(int n, int m) {
    if(n >= m) return 0;
    else return 1 + f(n + 1, m - 2);
}', '["1","3","5","7"]'::jsonb, 1, 'Apelul se desfășoară astfel: f(1,10) = 1 + f(2,8). Mai departe, f(2,8) = 1 + f(3,6), apoi f(3,6) = 1 + f(4,4). La apelul f(4,4) condiția n>=m (4>=4) este adevărată, deci returnează 0. Rezultatul final este 1 + 1 + 1 + 0 = 3.');

INSERT INTO questions (difficulty, type, category, subcategory, exam_type, text, image_url, code, options_json, correct_index, explanation) VALUES ('medium', 'choice', 'Tehnici de programare', 'Backtracking', 'BAC', 'O agenție de turism pune la dispoziție pachete de vacanță cu câte trei destinații, în ordinea: una pe Clisura Dunării, una la munte și una pe litoral. Utilizând metoda backtracking, se generează toate pachetele din mulțimile: {Dubova, Eșelnița, Șvinița} pentru Clisură, {Bușteni, Păltiniș, Predeal} pentru munte și {Venus, Neptun, Olimp} pentru litoral. Primele 5 soluții sunt: (Dubova, Bușteni, Venus), (Dubova, Bușteni, Neptun), (Dubova, Bușteni, Olimp), (Dubova, Păltiniș, Venus), (Dubova, Păltiniș, Neptun). Indicați pachetul generat imediat înainte de (Șvinița, Bușteni, Venus).', NULL, NULL, '["(Eșelnița, Bușteni, Venus)","(Eșelnița, Predeal, Olimp)","(Șvinița, Păltiniș, Olimp)","(Șvinița, Predeal, Olimp)"]'::jsonb, 1, 'Se generează produsul cartezian al celor 3 mulțimi (în ordinea elementelor date). Soluția (Șvinița, Bușteni, Venus) are primele elemente din mulțimea a doua și a treia, dar trece la al 3-lea element (''Șvinița'') din prima mulțime. Soluția generată anterior ei va fi ultima combinație posibilă care are pe prima poziție elementul precedent (''Eșelnița''), așadar va avea ultimul element din a 2-a mulțime (''Predeal'') și ultimul din a 3-a mulțime (''Olimp''). Rezultă (Eșelnița, Predeal, Olimp).');

INSERT INTO questions (difficulty, type, category, subcategory, exam_type, text, image_url, code, options_json, correct_index, explanation) VALUES ('easy', 'choice', 'Grafuri si Arbori', 'Grafuri orientate', 'BAC', 'Un graf orientat cu 4 vârfuri, numerotate de la 1 la 4, este reprezentat prin matricea de adiacență alăturată. Indicați un circuit elementar în acest graf.

0 1 1 0
1 0 1 0
0 0 0 1
1 1 0 0', NULL, NULL, '["1, 2, 1, 3, 4, 1","1, 2, 3, 4","1, 3, 4, 2, 1","1, 4, 3, 2, 1"]'::jsonb, 2, 'Matricea indică existența următoarelor arce: 1->2, 1->3, 2->1, 2->3, 3->4, 4->1, 4->2. Un circuit elementar începe și se termină în același nod fără a repeta alte noduri pe parcurs. Traseul 1->3->4->2->1 conține doar arce existente și îndeplinește condiția de circuit elementar.');

INSERT INTO questions (difficulty, type, category, subcategory, exam_type, text, image_url, code, options_json, correct_index, explanation) VALUES ('hard', 'choice', 'Grafuri si Arbori', 'Grafuri neorientate', 'BAC', 'O rețea din 12 centre e modelată ca un graf neorientat, cu muchiile: (1,2), (1,3), (2,3), (2,4), (3,5), (4,5), (4,6), (5,6), (6,7), (7,8), (7,9), (8,9), (9,10), (10,11), (10,12), (11,12). Indicați numărul minim de muchii care trebuie eliminate pentru ca graful parțial obținut să fie format din 3 componente conexe, fiecare cu câte 4 noduri.', NULL, NULL, '["2","4","5","7"]'::jsonb, 2, 'Componentele posibile de 4 noduri care necesită tăieri minime sunt: C1 = {1, 2, 3, 4}, C2 = {5, 6, 7, 8}, C3 = {9, 10, 11, 12}. Pentru a le izola: se taie (7,9) și (8,9) pentru a separa C3 de restul. Între C1 și C2 se taie muchiile care le unesc: (3,5), (4,5), (4,6). În total, 2 + 3 = 5 muchii tăiate.');

INSERT INTO questions (difficulty, type, category, subcategory, exam_type, text, image_url, code, options_json, correct_index, explanation) VALUES ('medium', 'choice', 'Fundamente', 'Expresii C/C++', 'BAC', 'Variabila x este de tip întreg. Indicați o expresie care are valoarea 1 dacă și numai dacă expresia C/C++ alăturată are valoarea 1.

x<=20 || x>26', NULL, NULL, '["!(x>20) || !(x<=26)","!(x>=20) && !(x>=26)","!(x<20 || x<=26)","!(x<20 && x<26)"]'::jsonb, 0, 'Aplicând regulile logice și negația: expresia !(x>20) este echivalentă cu x<=20, iar !(x<=26) este echivalentă cu x>26. Astfel, !(x>20) || !(x<=26) este exact x<=20 || x>26.');

INSERT INTO questions (difficulty, type, category, subcategory, exam_type, text, image_url, code, options_json, correct_index, explanation) VALUES ('hard', 'code', 'Tablouri bidimensionale', 'Matrice', 'BAC', 'Un mozaic este alcătuit din plăcuțe de formă pătrată, cu dimensiuni egale, de culoare albă sau roșie, așezate pe două rânduri și aliniate ca în exemplu. Mozaicul are un model în zig-zag dacă oricare două plăcuțe cu o latură comună au culoare diferită. Se știe că plăcuțele de pe latura din dreapta au culori diferite. Variabilele j și ok sunt întregi, iar variabila a este un tablou bidimensional cu două linii și 12 coloane, cu elemente de tip char, în care fiecare linie, în ordine, memorează succesiunea de plăcuțe aflate pe un rând al mozaicului, notându-se cu litera R cele roșii și cu litera A cele albe. Liniile și coloanele sunt numerotate începând de la 0.
Indicați expresia care poate înlocui punctele de suspensie astfel încât, în urma executării secvenței C/C++ obținute, variabila ok să aibă valoarea 1, dacă mozaicul are un model în zig-zag, sau valoarea 0 în caz contrar.
Exemplu: în urma executării secvenței pentru tabloul de mai jos, unde sunt evidențiate două zone în care nu se respectă modelul, ok=0.', NULL, 'ok=1;
for(j=0;j<11;j++)
  if(........) ok=0;', '["a[0][j]==a[0][j-1] || a[0][j]==a[1][j-1]","a[0][j]==a[0][j+1] || a[0][j]==a[1][j+1]","a[0][j]==a[0][j-1] || a[0][j]==a[1][j+1]","a[0][j]==a[0][j+1] || a[0][j]==a[1][j]"]'::jsonb, 3, 'Pentru a menține modelul zig-zag, orice celulă a[0][j] trebuie să fie diferită de vecinii săi care împart o latură cu ea. Vecinii săi din aceeași porțiune iterată sunt a[0][j+1] (la dreapta) și a[1][j] (dedesubt). Așadar, dacă a[0][j] are aceeași culoare cu oricare dintre aceștia (a[0][j]==a[0][j+1] || a[0][j]==a[1][j]), modelul este încălcat și ok devine 0.');

INSERT INTO questions (difficulty, type, category, subcategory, exam_type, text, image_url, code, options_json, correct_index, explanation) VALUES ('hard', 'code', 'Subprograme', 'Recursivitate', 'BAC', 'Subprogramul f este definit alăturat, iar variabila x este de tip întreg. Indicați ce se afișează în urma executării secvenței C/C++ de mai jos.

x=3; f(x);', NULL, 'void f(int &n)
{
  if(n>0) { 
    cout<<n; 
    n=n-1; 
    f(n);
    cout<<n;
  }
}', '["321000","321012","321123","3210123"]'::jsonb, 0, 'Variabila n este transmisă prin referință (&n), ceea ce înseamnă că toate apelurile recursive modifică aceeași zonă de memorie. La prima trecere, se afișează 3, apoi n scade la 2. Se apelează f(n), care afișează 2 și scade n la 1. Apelul f(1) afișează 1 și scade n la 0. Se apelează f(0), care nu face nimic. La finalizarea apelurilor, din cauza referinței, n rămâne 0. Secvențele cout<<n de după auto-apelare vor afișa 0 de fiecare dată, rezultând 321000.');

INSERT INTO questions (difficulty, type, category, subcategory, exam_type, text, image_url, code, options_json, correct_index, explanation) VALUES ('medium', 'choice', 'Tehnici de programare', 'Backtracking', 'BAC', 'La balul absolvenților se acordă șase premii pe baza unei tombole cu 30 de bilete, numerotate de la 30 la 1, în această ordine. Utilizând metoda backtracking, se generează toate variantele de a alege biletele celor șase câștigători, care sunt anunțați în ordine descrescătoare a numerelor de pe bilete. Două soluții diferă prin cel puțin un bilet. Primele trei soluții generate sunt, în această ordine: (30,29,28,27,26,25), (30,29,28,27,26,24), (30,29,28,27,26,23). Indicați penultima soluție generată.', NULL, NULL, '["(7,6,5,4,3,2)","(7,6,5,3,2,1)","(7,6,4,3,2,1)","(7,5,4,3,2,1)"]'::jsonb, 3, 'Se generează combinări de 30 luate câte 6, în ordine strict descrescătoare. Ultima soluție absolută care poate fi generată este formată din cele mai mici 6 numere disponibile, adică (6, 5, 4, 3, 2, 1). Pentru a o obține pe penultima, ultima poziție care mai poate fi crescută este elementul cel mai din stânga posibil. Astfel, 6 se transformă în 7, iar restul elementelor rămân cele mai mici posibile în continuare, adică 5, 4, 3, 2, 1. Rezultă (7, 5, 4, 3, 2, 1).');

INSERT INTO questions (difficulty, type, category, subcategory, exam_type, text, image_url, code, options_json, correct_index, explanation) VALUES ('hard', 'choice', 'Grafuri si Arbori', 'Arbori', 'BAC', 'Într-un arbore cu 7 noduri, numerotate de la 1 la 7, nodul 3 este rădăcină și pentru orice nod numerotat cu i (i∈[1,7]), dacă se notează cu F(i) numărul de descendenți direcți („fii”) ai lui, atunci F(i)=0, dacă i este „frunză”, sau F(i)=i-1, în caz contrar. Indicați numărul maxim de „frați” ai nodului 1.', NULL, NULL, '["1","2","3","4"]'::jsonb, 2, 'Pentru a maximiza numărul de frați ai nodului 1, acesta trebuie să fie descendent al unui nod x cu cât mai mulți fii. Cum F(x) = x-1, vrem ca x să fie maxim. Dacă x=6, ar avea 5 fii. Cu rădăcina 3 (F(3)=2 fii), numărul total de noduri ar fi 1(rădăcina) + 2(fiii) + 5 = 8 noduri (prea multe, deoarece avem maxim 7). Astfel, nodul parinte maxim permis este x=5. F(5) = 4 fii. Nodurile ar fi: 3 (radacina) avand fiii 2 și 5, iar 5 avand fiii 1,4,6,7. În total 7 noduri (valid!). Nodul 1 este printre cei 4 fii ai lui 5, prin urmare are 3 frați.');

INSERT INTO questions (difficulty, type, category, subcategory, exam_type, text, image_url, code, options_json, correct_index, explanation) VALUES ('easy', 'choice', 'Fundamente', 'Expresii C/C++', 'BAC', 'Indicați valoarea expresiei C/C++ alăturate.

20/25*20/2', NULL, NULL, '["0","0.02","0.08","8"]'::jsonb, 0, 'Operatorii / și * au aceeași prioritate și se evaluează de la stânga la dreapta. 20/25 este împărțire întrețegi, dând câtul 0. Apoi 0 * 20 = 0, iar 0 / 2 = 0. Rezultatul final este 0.');

INSERT INTO questions (difficulty, type, category, subcategory, exam_type, text, image_url, code, options_json, correct_index, explanation) VALUES ('hard', 'code', 'Subprograme', 'Recursivitate', 'BAC', 'Subprogramul f este definit alăturat.
Știind că variabila x memorează un tablou unidimensional cu elementele (2,0,2,6,8), în această ordine, numerotate de la 0 la 4, indicați valoarea f(0,4,x).', NULL, 'int f(int s,int d,int v[])
{ if(s==d) if(v[d]==2*d) return 1;
           else return 0;
  else return f(s,(s+d)/2,v) + f(1+(s+d)/2,d,v);
}', '["1","2","4","5"]'::jsonb, 1, 'Funcția folosește metoda Divide et Impera pentru a număra câte elemente din vector îndeplinesc condiția v[i] == 2*i. Verificăm elementele: v[0]=2 (fals), v[1]=0 (fals), v[2]=2 (fals), v[3]=6 (6==2*3, adevărat -> 1), v[4]=8 (8==2*4, adevărat -> 1). În total, condiția este îndeplinită de 2 ori, deci subprogramul returnează 2.');

INSERT INTO questions (difficulty, type, category, subcategory, exam_type, text, image_url, code, options_json, correct_index, explanation) VALUES ('hard', 'choice', 'Tehnici de programare', 'Backtracking', 'BAC', 'La un târg pentru copii, fiecare joc este asociat cu câte o singură abilitate – cheie... Utilizând metoda backtracking, se generează toate posibilitățile de a expune seturi de câte trei jocuri din mulțimea {jenga (motricitate), kendama (motricitate), lego (creativitate), șah (strategie), scrabble (vocabular)}, astfel încât să nu fie alese simultan două jocuri care dezvoltă aceeași abilitate - cheie, scrabble să NU apară pe prima poziție, iar șahul să NU fie înainte de jenga sau kendama. Două seturi sunt distincte dacă diferă prin cel puțin un joc sau dacă ordinea jocurilor este diferită. Primele cinci seturi generate sunt, în această ordine (jenga, lego, șah), (jenga, lego, scrabble), (jenga, șah, lego), (jenga, șah, scrabble), (jenga, scrabble, lego). Indicați penultimul set generat.', NULL, NULL, '["șah, lego, scrabble","șah, scrabble, lego","lego, jenga, șah","lego, șah, jenga"]'::jsonb, 0, 'Generarea se face în ordine lexicografică. Ultimul element pe prima poziție poate fi ''șah'' (deoarece ''scrabble'' nu are voie pe prima poziție). Dacă pe prima poziție e ''șah'', pe următoarele nu au voie să fie ''jenga'' sau ''kendama''. Așadar, singurele opțiuni valide care încep cu ''șah'' sunt combinațiile dintre ''lego'' și ''scrabble''. Cele 2 seturi generate la final vor fi (șah, lego, scrabble) și apoi (șah, scrabble, lego). Penultimul este, așadar, (șah, lego, scrabble).');

INSERT INTO questions (difficulty, type, category, subcategory, exam_type, text, image_url, code, options_json, correct_index, explanation) VALUES ('easy', 'code', 'Organizarea Datelor', 'Structuri', 'BAC', 'Variabila z, declarată alăturat, memorează unele date despre 100 dintre zonele continentului. Știind că densitatea unei zone este egală cu raportul dintre numărul de locuitori și suprafața acesteia (exprimată în km^2), indicați o expresie a cărei valoare este egală cu numărul de locuitori ai primei zone.', NULL, 'struct zona
{ char nume[21];
  int densitate;
  int suprafata;
}z[100];', '["z[0].densitate*z[0].suprafata","z.densitate[0]*z.suprafata[0]","densitate[0].z*suprafata[0].z","densitate.z[0]*suprafata.z[0]"]'::jsonb, 0, 'Vectorul se numește z. Prima zonă din vector se accesează prin z[0]. Din definiția densității, numărul de locuitori = densitate * suprafață. Deci expresia corectă va fi produsul atributelor pentru prima zonă: z[0].densitate * z[0].suprafata.');

INSERT INTO questions (difficulty, type, category, subcategory, exam_type, text, image_url, code, options_json, correct_index, explanation) VALUES ('medium', 'choice', 'Grafuri si Arbori', 'Grafuri neorientate', 'BAC', 'Un graf neorientat are 7 noduri, numerotate de la 1 la 7, și 8 muchii, dintre care șase sunt: [1,2], [2,5], [2,6], [2,7], [3,7], [4,7]. Știind că unul dintre lanțurile elementare care au lungimea maximă este 3, 7, 4, 5, 2, 1, indicați care ar putea fi celelalte două muchii ale grafului.', NULL, NULL, '["[1,6] și [4,5]","[2,3] și [2,4]","[2,3] și [4,5]","[2,4] și [5,7]"]'::jsonb, 2, 'Lanțul dat este format din muchiile: (3,7), (7,4), (4,5), (5,2), (2,1). Printre muchiile date, nu se află (4,5). Deoarece lanțul maxim trebuie să fie valid, rezultă obligatoriu că (4,5) se află printre cele 2 muchii lipsă. Avem 2 variante cu (4,5). Dacă am adăuga și (1,6), lanțul ar putea continua din 2 (prin muchia 2-6) astfel: 3-7-4-5-2-6-1, dând o lungime mai mare (6), ceea ce contrazice enunțul. Deci varianta corectă este [2,3] și [4,5].');

INSERT INTO questions (difficulty, type, category, subcategory, exam_type, text, image_url, code, options_json, correct_index, explanation) VALUES ('medium', 'grid', 'Grafuri si Arbori', 'Grafuri orientate', 'Admitere', 'Într-un graf orientat G(X, V) cu 8 noduri numerotate de la 1 la 8, există arc de la nodul i la nodul j dacă și numai dacă i < j și j - i > 2. Numărul de noduri din graf care au gradul interior mai mare decât gradul exterior este:', NULL, NULL, '["4","3","5","2"]'::jsonb, 0, 'Gradul interior (d-) reprezintă numărul de arce care intră în nod. Gradul exterior (d+) este numărul de arce care ies. Nodurile care îndeplinesc condiția d- > d+ sunt 5, 6, 7, 8 (în total 4 noduri).');

INSERT INTO questions (difficulty, type, category, subcategory, exam_type, text, image_url, code, options_json, correct_index, explanation) VALUES ('hard', 'grid', 'Grafuri si Arbori', 'Arbori', 'Admitere', 'Se numește înălțime a unui arbore cu rădăcină lungimea celui mai lung lanț cu extremitatea inițială în rădăcină. Într-un arbore cu 17 muchii, fiecare nod, cu excepția nodurilor terminale, are cel puțin 3 descendenți direcți. Înălțimea maximă a arborelui este:', NULL, NULL, '["5","4","6","17"]'::jsonb, 0, 'Pentru a maximiza înălțimea, construim un lanț cât mai lung în care fiecare nod de pe lanț are exact 1 fiu care continuă lanțul și 2 fii care sunt noduri terminale. Având 17 muchii, putem face un lanț de lungime 5 (5 * 3 = 15 muchii folosite), iar ultimele 2 muchii pot fi date ultimului nod (care devine frunză complexă). Deci lungimea lanțului este 5.');

INSERT INTO questions (difficulty, type, category, subcategory, exam_type, text, image_url, code, options_json, correct_index, explanation) VALUES ('hard', 'grid', 'Organizarea Datelor', 'Matrice', 'Admitere', 'Se consideră un tablou bidimensional A cu n linii și n coloane numerotate de la 1 la n. Stabiliți care dintre secvențele de mai jos calculează în variabila S suma tuturor elementelor aflate pe prima linie și pe prima coloană a tabloului A.', NULL, NULL, '["S=A[1][1];\\nfor (i=2;i<=n;i++)\\n    S=S+A[1][i]+A[n+2-i][1];","S=0;\\nfor (i=1;i<=n;i++)\\n    S=S+A[1][i]+A[i][1];","S=A[1][1];\\nfor (i=1;i<=n;i++)\\n    S=S+A[1][i]+A[n-i+1][1];","S=0;\\nfor (i=1;i<=n;i++)\\n    S=S+A[1][i]+A[i][1]-A[n][n];"]'::jsonb, 0, 'Varianta corectă adună elementul comun A[1][1] o singură dată. Apoi, prin `A[1][i]` se parcurge linia 1 normal de la 2 la n, iar prin `A[n+2-i][1]` se parcurge coloana 1 invers, de la n în jos până la 2, acoperind astfel toate elementele corect și fără duplicate.');

INSERT INTO questions (difficulty, type, category, subcategory, exam_type, text, image_url, code, options_json, correct_index, explanation) VALUES ('medium', 'grid', 'Backtracking', 'Teorie si aplicare practica', 'Admitere', 'Folosind tehnica backtracking se generează în ordine crescătoare toate numerele de 4 cifre, cu cifre distincte din mulțimea {1, 2, 3, 4} care au cifra sutelor egală cu 2. Care va fi penultima soluție generată?', NULL, NULL, '["4213","4231","3241","4321"]'::jsonb, 0, 'Pentru forma X 2 Y Z cu cifre din {1,2,3,4}, soluțiile generate în ordine sunt: 1234, 1243, 3214, 3241, 4213, 4231. Ultima este 4231, deci penultima este 4213.');

INSERT INTO questions (difficulty, type, category, subcategory, exam_type, text, image_url, code, options_json, correct_index, explanation) VALUES ('medium', 'grid', 'Fundamente', 'Structuri de control', 'Admitere', 'Precizați care dintre următoarele instrucțiuni realizează schimbarea primei cifre cu ultima cifră pentru un număr natural n cu exact 5 cifre:', NULL, NULL, '["n=n/10000 + n%10*10000 + n/10%1000*10;","n=n/10000*10000 + n%10 + n/10%1000*10;","n=n/10000 + n%10*10000 + n%1000*10;","n=n%10000 + n/10*10000 + n/10%1000*10;"]'::jsonb, 0, '`n/10000` extrage prima cifră care acum trebuie să devină ultima (o adunăm simplu). `n%10*10000` preia ultima cifră și o mută pe prima poziție. Restul cifrelor de mijloc (3 cifre) sunt extrase prin `n/10%1000` și mutate o poziție la stânga înmulțind cu 10.');

INSERT INTO questions (difficulty, type, category, subcategory, exam_type, text, image_url, code, options_json, correct_index, explanation) VALUES ('medium', 'grid', 'Fundamente', 'Structuri de control', 'Admitere', 'În algoritmul de mai jos s-a notat cu x%y restul împărțirii numărului natural x la numărul natural nenul y. Care este valoarea afișată dacă se citesc valorile 18 și 30?', NULL, 'citește x, y (numere naturale nenule)
s <- 0
d <- 2
┌ cât timp d <= x execută
│ ┌ dacă x%d = 0 și y%d = 0 atunci
│ │   s <- s+d
│ └■
│ d <- d+1
└■
scrie s', '["11","12","6","18"]'::jsonb, 0, 'Algoritmul calculează suma divizorilor comuni strict mai mari ca 1 pentru x și y. Pentru 18 și 30, acești divizori sunt 2, 3 și 6. Suma lor este 2 + 3 + 6 = 11.');

INSERT INTO questions (difficulty, type, category, subcategory, exam_type, text, image_url, code, options_json, correct_index, explanation) VALUES ('easy', 'grid', 'Organizarea Datelor', 'Structuri de date (struct)', 'Admitere', 'În declarațiile de mai jos câmpul x reprezintă abscisa, iar câmpul y ordonata unui punct în sistemul cartezian de coordonate. Care dintre expresii este adevărată dacă și numai dacă punctul memorat în variabila b se află pe axa Ox?', NULL, 'struct punct
{
    int x, y;
} b;', '["b.y == 0","b.x == 0","b.x == 0 && b.y == 0","b.x == b.y"]'::jsonb, 0, 'Un punct situat pe axa absciselor (Ox) are întotdeauna ordonata (y) egală cu zero.');

INSERT INTO questions (difficulty, type, category, subcategory, exam_type, text, image_url, code, options_json, correct_index, explanation) VALUES ('medium', 'grid', 'Organizarea Datelor', 'Siruri de caractere', 'Admitere', 'Ce valoare are variabila s de tip șir de caractere după executarea următoarelor instrucțiuni?', NULL, 'strncpy(s, strstr("academieadmitere2024", "ad"), strlen("sibiu"));
s[5]=''\0'';', '["ademi","admit","acade","sibiu"]'::jsonb, 0, 'strstr("academieadmitere2024", "ad") întoarce șirul începând de la prima apariție a lui "ad", adică "ademieadmitere2024". Apoi strncpy copiază primele 5 caractere (lungimea lui "sibiu"), rezultând "ademi". S[5]=''\0'' pune corect terminatorul de șir.');

INSERT INTO questions (difficulty, type, category, subcategory, exam_type, text, image_url, code, options_json, correct_index, explanation) VALUES ('medium', 'grid', 'Grafuri si Arbori', 'Grafuri orientate', 'Admitere', 'Într-un graf orientat cu 10 vârfuri numerotate de la 1 la 10 există arce numai între perechile de vârfuri i și j, i != j cu proprietatea că i este divizor al lui j, unde i este extremitatea inițială, iar j extremitatea finală a arcului. Numărul de valori egale cu 1 din matricea de adiacență corespunzătoare grafului este:', NULL, NULL, '["27","17","16","10"]'::jsonb, 1, 'Fiecare arc corespunde unei valori de 1 în matricea de adiacență. Căutăm perechile (i, j) cu i divizor propriu al lui j. Numărând pentru fiecare j de la 1 la 10 toți divizorii i < j, obținem: j=2(1), j=3(1), j=4(1,2), j=5(1), j=6(1,2,3), j=7(1), j=8(1,2,4), j=9(1,3), j=10(1,2,5). Suma: 1+1+2+1+3+1+3+2+3 = 17.');

INSERT INTO questions (difficulty, type, category, subcategory, exam_type, text, image_url, code, options_json, correct_index, explanation) VALUES ('easy', 'grid', 'Organizarea Datelor', 'Structuri de date (struct)', 'Admitere', 'Considerând următoarea declarare, alegeți formula corectă care calculează modulul numărului complex x.', NULL, 'struct complex {
  float re, im;
} x;', '["x.re*x.re + x.im*x.im","sqrt(re*re + im*im)","sqrt(x.re + x.im)","sqrt(x.re*x.re + x.im*x.im)"]'::jsonb, 3, 'Formula modulului unui număr complex z = a + bi este sqrt(a^2 + b^2). Accesarea câmpurilor se face folosind operatorul punct (x.re și x.im).');

INSERT INTO questions (difficulty, type, category, subcategory, exam_type, text, image_url, code, options_json, correct_index, explanation) VALUES ('hard', 'grid', 'Fundamente', 'Structuri de control', 'Admitere', 'Se consideră algoritmul următor, scris în pseudocod, în care s-a notat cu [x] partea întreagă a numărului real x, iar cu x%y restul împărțirii numărului întreg x la numărul întreg nenul y. Care vor fi valorile afișate dacă se citesc pe rând valorile 15, 13, 305, 12600, 5, 210, 32, 0.', NULL, 'citește x (număr întreg)
m <- 0
┌ cât timp x > 0 execută
│ d <- 2; k <- 0; y <- x
│ ┌ cât timp y != 1 execută
│ │ p <- 0
│ │ ┌ cât timp y % d = 0 execută
│ │ │ y <- [y / d]
│ │ │ p <- 1
│ │ └■
│ │ k <- k + p; d <- d + 1
│ └■
│ ┌ dacă k >= m atunci
│ │ m <- k; nr <- x
│ └■
│ citește x
└■
scrie m, '' '', nr', '["4 12600","4 210","5 12600","3 210"]'::jsonb, 1, 'Algoritmul descompune x în factori primi și k reține numărul de factori primi DISTINCTI. m memorează maximul acestui k, iar nr memorează ultimul x care atinge acest maxim. Pentru 12600 (factori 2,3,5,7), k=4. Pentru 210 (factori 2,3,5,7), k=4. Deoarece verificarea este k >= m (4 >= 4 este Adevărat), nr se actualizează cu ultimul număr citit (210).');

INSERT INTO questions (difficulty, type, category, subcategory, exam_type, text, image_url, code, options_json, correct_index, explanation) VALUES ('medium', 'grid', 'Subprograme', 'Recursivitate', 'Admitere', 'Se consideră subprogramul f definit alăturat. Ce se va afișa în urma apelului f(4)?', NULL, 'void f(int n) {
  if (n != 0) {
    if (n % 2 == 0)
      cout << n;
    f(n-1);
    cout << n;
  }
}', '["421234","43211234","4201234","4224"]'::jsonb, 0, 'Urmărim apelurile: f(4) printează 4, apelează f(3), apoi printează 4. f(3) apelează f(2), apoi printează 3. f(2) printează 2, apelează f(1), apoi printează 2. f(1) apelează f(0), apoi printează 1. Asamblând la întoarcerea din recursivitate, se obține ordinea: 421234.');

INSERT INTO questions (difficulty, type, category, subcategory, exam_type, text, image_url, code, options_json, correct_index, explanation) VALUES ('medium', 'grid', 'Organizarea Datelor', 'Matrice', 'Admitere', 'În secvența următoare i și j sunt variabile întregi, iar b este un tablou bidimensional cu 10 linii și 10 coloane, numerotate de la 1 la 10. Indicați numărul de elemente pare aflate pe diagonala principală a tabloului b după executarea următoarei secvențe de instrucțiuni:', NULL, 'for (i=1; i<=10; i++)
  for (j=1; j<=10; j++)
    b[i][j] = (2*i+j)%5;', '["5","4","7","6"]'::jsonb, 3, 'Pe diagonala principală i = j. Prin urmare, b[i][i] = (2*i+i)%5 = (3*i)%5. Căutăm valorile pentru care (3*i)%5 este par (adica rest 0, 2 sau 4), unde i parcurge de la 1 la 10. Valorile pare se obțin pentru i ∈ {3, 4, 5, 8, 9, 10}, adică un total de 6 elemente.');

INSERT INTO questions (difficulty, type, category, subcategory, exam_type, text, image_url, code, options_json, correct_index, explanation) VALUES ('medium', 'grid', 'Fundamente', 'Structuri de control', 'Admitere', 'Precizați care dintre următoarele instrucțiuni inserează cifra 5 în fața ultimei cifre a numărului natural n.', NULL, NULL, '["n = (n/10 + 5)*10 + n%10;","n = n/10*10 + 5 + n%10;","n = (n/10*10 + 5)*10 + n%10;","n = n/10*100 + 5*10 + n/10%10;"]'::jsonb, 2, 'Pentru a insera cifra 5, se elimină temporar ultima cifră (n/10). Apoi se face loc de încă o cifră înmulțind cu 10, se adaugă 5, iar apoi se mai înmulțește tot rezultatul cu 10 pentru a lăsa loc și a adăuga în final ultima cifră (n%10).');

INSERT INTO questions (difficulty, type, category, subcategory, exam_type, text, image_url, code, options_json, correct_index, explanation) VALUES ('medium', 'grid', 'Organizarea Datelor', 'Siruri de caractere', 'Admitere', 'Se consideră un șir s de maximum 20 de caractere ce conține inițial textul "AcademiE2023" și o variabilă i de tip întreg. Ce se va afișa pe ecran după executarea următoarei secvențe de instrucțiuni:', NULL, 'for (i=0; i<strlen(s); i++)
  if (s[i]>=''a'' && s[i]<=''i'')
    cout<<s[i]-''a'';
  else
    cout<<s[i];', '["A2034M8E2023","A2034m8E2023","AcademiE2023","A2348E2023"]'::jsonb, 1, 'Condiția `s[i]>=''a'' && s[i]<=''i''` verifică literele mici până la ''i''. În C/C++, scăderea a două caractere determină rezultatul ca întreg (promovare la int). Astfel, literele (c,a,d,e,i) se vor înlocui cu distanța lor față de ''a'': c->2, a->0, d->3, e->4, i->8. Litera ''m'' nu intră în condiție. Obținem A2034m8E2023.');
