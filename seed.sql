-- Seed data for questions table
TRUNCATE TABLE questions RESTART IDENTITY CASCADE;

INSERT INTO questions (difficulty, type, text, code, options_json, correct_index, explanation) VALUES
-- ===================== USOARE (1-10) =====================
(
    'easy',
    'choice',
    'Ce tip de date este potrivit pentru a memora nota unui elev (de exemplu, 9.50)?',
    NULL,
    '["int", "char", "float", "bool"]'::jsonb,
    2,
    'Tipul float (sau double) poate stoca numere cu parte zecimala, spre deosebire de int care stocheaza doar numere intregi.'
),
(
    'easy',
    'choice',
    'Care dintre urmatoarele declarari de variabile este corecta in C++?',
    NULL,
    '["int 2x = 10;", "float nota = 9.5;", "char = ''A'';", "int x y = 5;"]'::jsonb,
    1,
    'Numele unei variabile nu poate incepe cu o cifra (2x), trebuie specificat un nume (char), si nu pot fi doua nume separate de spatiu (x y).'
),
(
    'easy',
    'choice',
    'Ce valoare va afisa urmatorul cod?',
    'cout << 17 / 5;',
    '["3.4", "3", "4", "2"]'::jsonb,
    1,
    'Impartirea intre doua valori de tip int produce un rezultat int (impartire intreaga). 17 / 5 = 3 (restul se pierde).'
),
(
    'easy',
    'choice',
    'Ce valoare va afisa urmatorul cod?',
    'cout << 17 % 5;',
    '["3", "5", "2", "12"]'::jsonb,
    2,
    'Operatorul % (modulo) returneaza restul impartirii. 17 = 5 * 3 + 2, deci restul este 2.'
),
(
    'easy',
    'choice',
    'Ce va afisa urmatorul cod?',
    'int x = 7;\nif (x % 2 == 0)\n    cout << "par";\nelse\n    cout << "impar";',
    '["par", "impar", "7", "Eroare de compilare"]'::jsonb,
    1,
    '7 % 2 = 1 (diferit de 0), deci se executa ramura else care afiseaza "impar".'
),
(
    'easy',
    'choice',
    'Care este instructiunea corecta pentru a citi o valoare de la tastatura in variabila x?',
    NULL,
    '["cout >> x;", "cin << x;", "cin >> x;", "read(x);"]'::jsonb,
    2,
    'cin (console input) foloseste operatorul >> pentru citire. cout foloseste << pentru afisare.'
),
(
    'easy',
    'code',
    'Completati conditia buclei for astfel incat programul sa afiseze: 1 2 3 4 5',
    'for (________)\n    cout << i << " ";',
    '["int i = 0; i < 5; i++", "int i = 1; i <= 5; i++", "int i = 1; i < 5; i++", "int i = 0; i <= 5; i++"]'::jsonb,
    1,
    'Pentru a afisa 1, 2, 3, 4, 5 trebuie ca i sa inceapa de la 1 si sa mearga pana la 5 inclusiv (i <= 5).'
),
(
    'easy',
    'choice',
    'Care dintre urmatoarele expresii are valoarea true (1) daca x = 5?',
    NULL,
    '["x > 5", "x == 4", "x != 5", "x >= 5"]'::jsonb,
    3,
    'x >= 5 inseamna "x mai mare sau egal cu 5". Cum x = 5, conditia este adevarata. Celelalte: 5 > 5 e fals, 5 == 4 e fals, 5 != 5 e fals.'
),
(
    'easy',
    'choice',
    'Ce valoare va avea variabila x dupa executarea secventei?',
    'int x = 3;\nx = x + 2;\nx = x * 2;',
    '["7", "10", "16", "12"]'::jsonb,
    1,
    'x = 3, apoi x = 3 + 2 = 5, apoi x = 5 * 2 = 10.'
),
(
    'easy',
    'code',
    'Completati linia lipsa pentru a interschimba valorile variabilelor a si b:',
    'int a = 5, b = 3, aux;\naux = a;\n________;\nb = aux;',
    '["a = aux", "a = b", "b = a", "aux = b"]'::jsonb,
    1,
    'Interschimbarea clasica: aux = a (salvam a), a = b (a primeste valoarea lui b), b = aux (b primeste valoarea veche a lui a).'
),

-- ===================== MEDII (11-20) =====================
(
    'medium',
    'choice',
    'Ce va afisa urmatorul cod?',
    'int n = 1234, s = 0;\nwhile (n > 0) {\n    s = s + n % 10;\n    n = n / 10;\n}\ncout << s;',
    '["1234", "4", "10", "4321"]'::jsonb,
    2,
    'Codul calculeaza suma cifrelor: 4 + 3 + 2 + 1 = 10. La fiecare pas, n % 10 extrage ultima cifra, iar n / 10 elimina ultima cifra.'
),
(
    'medium',
    'choice',
    'Ce va afisa urmatorul cod?',
    'int v[] = {3, 7, 1, 9, 4};\ncout << v[1] + v[3];',
    '["10", "16", "4", "12"]'::jsonb,
    1,
    'Indexarea tablourilor incepe de la 0. v[1] = 7 (al doilea element) si v[3] = 9 (al patrulea element). 7 + 9 = 16.'
),
(
    'medium',
    'code',
    'Completati linia lipsa pentru a calcula suma elementelor vectorului:',
    'int v[] = {2, 5, 3, 8}, s = 0;\nfor (int i = 0; i < 4; i++)\n    ________;\ncout << s;',
    '["s = v[i]", "s = s + i", "s = s + v[i]", "v[i] = s + v[i]"]'::jsonb,
    2,
    'Pentru a calcula suma, adunam fiecare element v[i] la variabila s: s = s + v[i] (sau echivalent: s += v[i]).'
),
(
    'medium',
    'choice',
    'Ce va afisa urmatorul cod?',
    'int f(int x) {\n    return x * x + 1;\n}\nint main() {\n    cout << f(3);\n    return 0;\n}',
    '["7", "9", "10", "4"]'::jsonb,
    2,
    'Functia f primeste x = 3 si returneaza 3 * 3 + 1 = 9 + 1 = 10.'
),
(
    'medium',
    'choice',
    'Ce valoare are expresia urmatoare, daca a = 5 si b = 3?',
    '(a > 3) && (b < 2) || (a + b == 8)',
    '["1 (true)", "0 (false)", "8", "Eroare de compilare"]'::jsonb,
    0,
    'Operatorul && are prioritate mai mare decat ||. Deci: (true && false) || true = false || true = true (1).'
),
(
    'medium',
    'code',
    'Completati conditia din if pentru ca variabila prim sa devina 0 daca n NU este prim:',
    'int n = 7, prim = 1;\nfor (int d = 2; d * d <= n; d++)\n    if (________) prim = 0;',
    '["n == d", "n % d == 0", "d % n == 0", "n / d == 0"]'::jsonb,
    1,
    'Un numar n nu este prim daca are un divizor d (altul decat 1 si n). Conditia n % d == 0 verifica daca d divide pe n.'
),
(
    'medium',
    'choice',
    'Ce va afisa urmatorul cod pentru n = 305?',
    'int n = 305, c = 0;\nwhile (n) {\n    c++;\n    n /= 10;\n}\ncout << c;',
    '["305", "8", "3", "2"]'::jsonb,
    2,
    'Codul numara cifrele lui n. La fiecare pas, n se imparte la 10: 305 -> 30 -> 3 -> 0. Contorul c devine 3.'
),
(
    'medium',
    'choice',
    'Care este diferenta principala dintre instructiunile do...while si while?',
    NULL,
    '["do...while nu foloseste conditie", "do...while executa corpul cel putin o data", "while este mai rapid decat do...while", "do...while nu poate contine variabile"]'::jsonb,
    1,
    'La do...while, corpul buclei se executa prima data, apoi se verifica conditia. La while, conditia se verifica inainte.'
),
(
    'medium',
    'code',
    'Completati conditia din if pentru a numara cate litere ''a'' contine sirul:',
    'char s[] = "abracadabra";\nint nr = 0;\nfor (int i = 0; i < strlen(s); i++)\n    if (________) nr++;\ncout << nr;',
    '["s[i] = ''a''", "s[i] == ''a''", "s == ''a''", "s[i] == \\"a\\""]'::jsonb,
    1,
    'Comparatia se face cu == (nu cu =, care este atribuire). Se compara caracterul s[i] cu constanta caracter ''a'' (nu cu sirul "a").'
),
(
    'medium',
    'choice',
    'Ce va afisa urmatorul cod?',
    'int a[3][4] = {\n    {1, 2, 3, 4},\n    {5, 6, 7, 8},\n    {9, 10, 11, 12}\n};\ncout << a[1][2];',
    '["6", "7", "3", "10"]'::jsonb,
    1,
    'a[1][2] = elementul de pe linia 1 (a doua linie, indexare de la 0), coloana 2 (a treia coloana) = 7.'
),

-- ===================== GRELE (21-30) =====================
(
    'hard',
    'choice',
    'Ce va afisa urmatorul cod?',
    'void f(int n) {\n    if (n > 0) {\n        f(n - 1);\n        cout << n << " ";\n    }\n}\nint main() {\n    f(4);\n    return 0;\n}',
    '["4 3 2 1", "1 2 3 4", "4 3 2 1 0", "0 1 2 3 4"]'::jsonb,
    1,
    'Functia se autoapeleaza recursiv cu n-1 inainte de afisare. Afisarea are loc la revenirea din recursie, deci in ordine crescatoare: 1 2 3 4.'
),
(
    'hard',
    'code',
    'Completati instructiunea return pentru a calcula al n-lea termen Fibonacci\n(fib(0) = 0, fib(1) = 1, fib(2) = 1, fib(3) = 2, ...):',
    'int fib(int n) {\n    if (n <= 1) return n;\n    return ________;\n}',
    '["fib(n - 1) + fib(n + 1)", "fib(n - 1) + fib(n - 2)", "fib(n) + fib(n - 1)", "n * fib(n - 1)"]'::jsonb,
    1,
    'Sirul Fibonacci: fib(n) = fib(n-1) + fib(n-2). Fiecare termen este suma celor doi anteriori.'
),
(
    'hard',
    'choice',
    'Se considera un arbore cu radacina cu 7 noduri, memorat cu ajutorul vectorului de tati: t = (4, 4, 0, 3, 1, 3, 5). Care este nodul radacina al acestui arbore?',
    NULL,
    '["Nodul 4", "Nodul 3", "Nodul 0", "Nodul 5"]'::jsonb,
    1,
    'Nodul radacina este singurul nod care nu are tata in arbore, reprezentat prin valoarea 0 in vectorul de tati. In vectorul t, valoarea 0 se afla pe pozitia 3, deci nodul 3 este radacina.'
),
(
    'hard',
    'choice',
    'Ce va afisa urmatorul cod dupa o singura parcurgere a vectorului?',
    'int v[] = {5, 3, 8, 1}, n = 4;\nfor (int i = 0; i < n - 1; i++)\n    if (v[i] > v[i + 1]) {\n        int aux = v[i];\n        v[i] = v[i + 1];\n        v[i + 1] = aux;\n    }\nfor (int i = 0; i < n; i++)\n    cout << v[i] << " ";',
    '["1 3 5 8", "3 5 1 8", "5 3 8 1", "3 1 5 8"]'::jsonb,
    1,
    'Bubble Sort, o parcurgere: (5,3)->swap->{3,5,8,1}, (5,8)->ok, (8,1)->swap->{3,5,1,8}. Rezultat: 3 5 1 8.'
),
(
    'hard',
    'code',
    'Completati linia lipsa in algoritmul de cautare binara:',
    'int st = 0, dr = n - 1, gasit = 0;\nwhile (st <= dr && !gasit) {\n    int mij = ________;\n    if (v[mij] == x) gasit = 1;\n    else if (v[mij] < x) st = mij + 1;\n    else dr = mij - 1;\n}',
    '["(st + dr) / 2", "st + dr", "(st - dr) / 2", "st / 2 + dr"]'::jsonb,
    0,
    'Mijlocul intervalului [st, dr] se calculeaza ca (st + dr) / 2. Aceasta este formula clasica a cautarii binare.'
),
(
    'hard',
    'choice',
    'Care este complexitatea de timp a algoritmului de cautare binara intr-un vector sortat cu n elemente?',
    NULL,
    '["O(n)", "O(n²)", "O(log n)", "O(1)"]'::jsonb,
    2,
    'Cautarea binara injumatateste intervalul la fiecare pas, deci numarul de pasi este proportional cu log2(n).'
),
(
    'hard',
    'code',
    'Completati conditia buclei for pentru a inversa (oglindi) elementele vectorului:',
    'int v[] = {1, 2, 3, 4, 5}, n = 5;\nfor (int i = 0; ________; i++) {\n    int aux = v[i];\n    v[i] = v[n - 1 - i];\n    v[n - 1 - i] = aux;\n}',
    '["i < n", "i < n / 2", "i <= n", "i < n - 1"]'::jsonb,
    1,
    'Se interschimba elementele simetrice. Trebuie parcursa doar jumate din vector (i < n/2), altfel elementele s-ar interschimba de doua ori, revenind la forma initiala.'
),
(
    'hard',
    'choice',
    'Ce va afisa urmatorul cod?',
    'void f(int &a, int b) {\n    a = a + 1;\n    b = b + 1;\n}\nint main() {\n    int x = 5, y = 10;\n    f(x, y);\n    cout << x << " " << y;\n    return 0;\n}',
    '["5 10", "6 11", "6 10", "5 11"]'::jsonb,
    2,
    'Parametrul a este transmis prin referinta (&), deci modificarea lui a afecteaza x. Parametrul b este transmis prin valoare, deci y ramane neschimbat. Rezultat: 6 10.'
),
(
    'hard',
    'choice',
    'Care este principiul de baza al tehnicii backtracking?',
    NULL,
    '["Sortarea datelor inainte de prelucrare", "Generarea solutiilor prin incercare si revenire", "Impartirea problemei in subprobleme independente", "Memorarea rezultatelor intermediare pentru eficienta"]'::jsonb,
    1,
    'Backtracking construieste solutii pas cu pas, verifica conditii, si revine (backtrack) cand o cale nu duce la solutie. Optiunea c) descrie Divide et Impera, iar d) descrie Programarea Dinamica.'
),
(
    'hard',
    'code',
    'Completati linia lipsa in algoritmul lui Euclid pentru calculul celui mai mare divizor comun (CMMDC):',
    'int cmmdc(int a, int b) {\n    while (b != 0) {\n        int r = a % b;\n        ________;\n        b = r;\n    }\n    return a;\n}',
    '["a = r", "a = b", "r = b", "a = a % b"]'::jsonb,
    1,
    'Algoritmul lui Euclid: se calculeaza restul r = a % b, apoi a primeste valoarea lui b, iar b primeste restul r. Se repeta pana cand b devine 0.'
);
