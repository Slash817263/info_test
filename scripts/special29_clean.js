const fs = require('fs');

const special29 = {
    1146: {
        text: "Se definește funcția:\nMnk = { Mn-1k + k * Mn-1k-1 pentru k > 0\n      1 pentru k = 0\nDacă se citesc numerele naturale n, k (n >= k) și se apelează funcția recursivă scrisă în limbajul C++ care evaluează funcția definită mai sus, valoarea calculată reprezintă:",
        code: null,
        type: "choice"
    },
    1155: {
        text: "Se definește recursiv o funcție care calculează numărul combinărilor de n luate câte k astfel:\nCnk = { (n-k+1)/k * Cnk-1 pentru k > 0\n      1 pentru k = 0\nDacă se citesc numerele naturale n, k (n >= k) și se apelează funcția recursivă scrisă în limbajul C++ care evaluează funcția definită mai sus, precizați care este numărul apelurilor necesare pentru a calcula Cnk:",
        code: null,
        type: "choice"
    },
    1170: {
        text: "Fie secvența de instrucțiuni folosită pentru ridicarea la puterea p a unei matrice pătratice a, de ordin n. Elementele tabloului a sunt numere întregi, iar n și p sunt numere naturale nenule. Variabilele a, b, c sunt tablouri bidimensionale, cu n linii și n coloane, iar variabilele i, j, k sunt de tip întreg. Precizați de câte ori se execută operația de înmulțire în cadrul secvenței date pentru ridicarea la puterea p a matricei pătratice a de ordin n.",
        code: `for (i = 1; i <= n; i++)\n    for (j = 1; j <= n; j++)\n        b[i][j] = (i == j);\n\nfor (q = 1; q <= p; q++) {\n    for (i = 1; i <= n; i++)\n        for (j = 1; j <= n; j++) {\n            c[i][j] = 0;\n            for (k = 1; k <= n; k++)\n                c[i][j] = c[i][j] + b[i][k] * a[k][j];\n        }\n    for (i = 1; i <= n; i++)\n        for (j = 1; j <= n; j++)\n            b[i][j] = c[i][j];\n}`,
        type: "code"
    },
    1180: {
        text: "Precizați care este complexitatea timp pentru următoarea secvență de program, unde n reprezintă numărul de elemente al unui tablou unidimensional v, numerotat de la 1 la n, cu elemente numere întregi, iar x un număr întreg.",
        code: `j = 0;\nfor (i = 1; i <= n; i++)\n    if (v[i] != x) {\n        j++;\n        v[j] = v[i];\n    }\nn = j;`,
        type: "code"
    },
    1182: {
        text: "Fie următoarele două secvențe de cod: Cu ce trebuie înlocuite <initial> și <condition> astfel încât cele două secvențe de cod să fie echivalente (în final variabila s să aibă aceeași valoare)?",
        code: `// Secvența 1:\ns = 0;\nfor (i = 1; i <= n; i++)\n    s = s + i * i;\n\n// Secvența 2:\ns = 0;\ni = <initial>;\nwhile (<condition>) {\n    s = s + i * i;\n    i = i - 1;\n}`,
        type: "code"
    },
    1183: {
        text: "Precizați secvența de instrucțiuni echivalentă cu următoarea secvență de cod.",
        code: `if (a > b)\n    if (a % 2 == 0)\n        c = a;\n    else\n        c = b;\nelse if (b % 2 == 0)\n    c = a;\nelse\n    c = b;`,
        type: "code"
    },
    1186: {
        text: "Se consideră un tablou bidimensional A, cu n linii şi n coloane, notăm cu Aij elementul aflat pe linia i şi coloana j (1≤i≤n, 1≤j≤n). Precizați condiţia necesară ca elementul Aij să fie situat deasupra ambelor diagonale.",
        code: null,
        type: "choice"
    },
    1187: {
        text: "Precizați câte dintre următoarele expresii au valoarea 1 dacă și numai dacă x ∈ (-∞, -10) ∪ [10, 100).",
        code: `1. x < -10 && x >= 10 && x < 100\n2. x < -10 || x >= 10 && x < 100\n3. !(x >= -10) || !(!(x >= 10) || x < 100)\n4. x < -10 || !(!(x >= 10) || x >= 100)\n5. x < -10 && x >= 10`,
        type: "code"
    },
    1191: {
        text: "Se consideră variabilele de tip întreg a=15, b=30, c=5, d=10 și R. Indicați valoarea variabilei R în urma executării instrucțiunii:",
        code: `R = a + b / c + d;`,
        type: "code"
    },
    1192: {
        text: "Fie următoarele două secvențe de cod: Indicați cu ce trebuie înlocuite <initial> și <instrucțiune> astfel încât cele două secvențe de cod să fie echivalente (în final variabila s să aibă aceeași valoare).",
        code: `// Secvența 1:\ns = 0;\nfor (i = 1; i <= n; i++)\n    s = s + i * i;\n\n// Secvența 2:\ns = 0;\ni = <initial>;\ndo {\n    s = s + i * i;\n    <instrucțiune>\n} while (i >= 1);`,
        type: "code"
    },
    1193: {
        text: "Precizați secvența de instrucțiuni echivalentă cu următoarea secvență de cod.",
        code: `if (a > b)\n    if (a % 2 == 0)\n        if (b % 2 == 0)\n            c = a;\n        else\n            c = b;`,
        type: "code"
    },
    1196: {
        text: "Precizați intervalul căruia îi aparţine valoarea memorată de variabila reală x, astfel încât expresia următoare să aibă valoarea 1:",
        code: `x < -10 || !(!(x >= 10) || x >= 100)`,
        type: "code"
    },
    1217: {
        text: "Fie subprogramul f definit mai jos. Subprogramul se execută pentru următoarele seturi de valori: (n=720, s=2), (n=120, s=3), (n=120, s=1), (n=720, s=1). Pentru câte dintre apeluri subprogramul f va returna valoarea 5?",
        code: `int f(int n, int s) {\n    if (n < s)\n        return 0;\n    else if (n % s == 0)\n        return 1 + f(n / s, s + 1);\n    else\n        return f(n / s, s);\n}`,
        type: "code"
    },
    1239: {
        text: "Pentru care dintre următoarele apeluri funcția f va returna valoarea 1?",
        code: `int f(int n) {\n    int m = 0, n1 = n;\n    while (n != 0) {\n        m = m * 10 + n % 10;\n        n = n / 10;\n    }\n    if (m == n1)\n        return 1;\n    else\n        return 0;\n}`,
        type: "code"
    },
    1245: {
        text: "Ce va afișa următoarea funcție la apelul f(30)?",
        code: `int f(int n) {\n    if (n > 50)\n        return n - 5;\n    else\n        return f(f(n + 7));\n}`,
        type: "code"
    },
    1282: {
        text: "Variabilele s, i, c sunt de tip întreg. Variabila c memorează un număr natural par. În urma executării secvenței de instrucțiuni, variabila s are valoarea:",
        code: `s = 0;\nfor (i = 1; i <= c / 2; i++)\n    s = s + i;\ns = 2 * s;\ncout << s;`,
        type: "code"
    },
    1284: {
        text: "În urma executării următorului program se va afișa:",
        code: `int main() {\n    int c, i, nr = 0;\n    for (i = 200; i <= 300; i++) {\n        c = i;\n        while (c != 0) {\n            if (c % 2 == 1)\n                nr++;\n            c = c / 10;\n        }\n    }\n    cout << nr;\n    return 0;\n}`,
        type: "code"
    },
    1302: {
        text: "În secvențele de instrucțiuni S1 și S2 variabilele n și p sunt de tip întreg. Obținerea în variabila p a primei cifre a numărului reținut inițial de n este realizată:",
        code: `// S1:\np = n;\nwhile (p > 9) {\n    p /= 10;\n}\n\n// S2:\ndo {\n    p = n % 10;\n    n /= 10;\n} while (n != 0);`,
        type: "code"
    },
    1455: {
        text: "După rularea următoarei secvențe de instrucțiuni se afișează:",
        code: `int i = 0, j = 5, aux, v[] = {41, 52, 26, 11, 48, 65};\nwhile (i < j) {\n    for (; i < j && !(v[i] % 2); i++);\n    for (; i < j && (v[j] % 2); j--);\n    if (i < j)\n        aux = v[i], v[i] = v[j], v[j] = aux;\n}\nfor (i = 0; i < 6; ++i)\n    cout << v[i] << " ";`,
        type: "code"
    },
    1458: {
        text: "Pentru ca, după rularea următoarei secvențe de instrucțiuni, să se afișeze valoarea 7, punctele de suspensie se înlocuiesc cu:",
        code: `int i, p, v[10] = {2, 6, 8, 12, 20, 25, 30, 37, 41, 92};\nfor (p = 1; p < 10; p *= 2);\nfor (i = 0; p; ...)\n    if (i + p < 10 && v[i + p] <= 40)\n        i += p;\ncout << i;`,
        type: "code"
    },
    1464: {
        text: "Precizaţi care este numărul elementelor egale cu 1 (pentru limbajul C++) aflate pe diagonala principală în urma executării secvenței de mai jos, în care a este un tablou bidimensional cu n linii și n coloane, iar i, j sunt variabile de tip întreg.",
        code: `for (i = n; i >= 1; i--)\n    for (j = n; j >= 1; j--)\n        a[i][j] = (i == j);`,
        type: "code"
    },
    1475: {
        text: "Indicați ce reprezintă valoarea afișată în urma rulării programului de mai jos:",
        code: `#include <iostream>\nusing namespace std;\n\nint f(int n, int k) {\n    if (k == 1 || k == n)\n        return 1;\n    else if (k > n)\n        return 0;\n    else\n        return f(n - 1, k - 1) + k * f(n - 1, k);\n}\n\nint main() {\n    int n, k, s = 0;\n    cin >> n;\n    for (k = 1; k <= n; k++)\n        s = s + f(n, k);\n    cout << s;\n    return 0;\n}`,
        type: "code"
    },
    1488: {
        text: "Precizați care este valoarea inițială a variabilei întregi n pentru ca secvența de program de mai jos să afișeze $$$$$:",
        code: `while (n != 3) {\n    n--;\n    cout << "$$";\n}`,
        type: "code"
    },
    1497: {
        text: "Precizați care vor fi valorile afișate în urma rulării programului de mai jos pentru variabilele a=2020, iar b=17:",
        code: `#include <iostream>\nusing namespace std;\n\nint a = 2020, b = 17;\nvoid f(int n, int m) {\n    if (n != m) {\n        if (n > m)\n            f(n - m, m);\n        else\n            f(n, m - n);\n    } else {\n        cout << a * b / n << " " << m;\n    }\n}\n\nint main() {\n    f(a, b);\n    return 0;\n}`,
        type: "code"
    },
    1499: {
        text: "Ce se va afișa în urma rulării secvenței de cod de mai jos:",
        code: `int main() {\n    int p, *q;\n    p = 45;\n    q = &p;\n    cout << q[0];\n    return 0;\n}`,
        type: "code"
    },
    1507: {
        text: "Corectați secvența de program de mai jos astfel încât să realizeze corect căutarea unui număr întreg x într-un vector v cu n elemente numere întregi ordonate crescător:",
        code: `p = 0;\nu = n - 1;\nq = 0;\nwhile (p <= u && q == 0) {\n    m = (p + u) / 2;\n    if (x == v[m])\n        q = 1;\n    else if (x < v[m])\n        u = m - 1;\n    else\n        p = m - 1;\n}\nif (q == 1)\n    cout << "Elementul a fost gasit";\nelse\n    cout << "Elementul nu a fost gasit";`,
        type: "code"
    },
    1512: {
        text: "Robotul Robi se află într-un plan cartezian și are în jurul lui un grup de n roboți. El “mănâncă” robotul cel mai apropiat din grupul de roboți. Atât robotul Robi cât și ceilalți roboți sunt identificați prin coordonatele lor. Datele de intrare se citesc de la tastatură astfel: n, numărul roboților din grup, apoi coordonatele robotului Robi și în continuare coordonatele celor n roboți. Corectați programul de mai jos astfel încât să afișeze corect coordonatele robotului care va fi “mâncat”. În cazul în care există mai mulți roboți la aceeași distanță față de Robi, este mâncat primul robot întâlnit la distanța respectivă.",
        code: `#include <iostream>\n#include <cmath>\nusing namespace std;\n\nstruct robot {\n    float x, y;\n};\n\nfloat distanta(robot r1, robot r2) {\n    return sqrt((r1.x - r2.x) * (r1.x - r2.x) + (r1.y - r2.y) * (r1.y - r2.y));\n}\n\nint gaseste(robot robi, robot a[], int n) {\n    float min, d;\n    int i, poz;\n    min = distanta(robi, a[0]);\n    poz = 1;\n    for (i = 1; i < n; i++) {\n        d = distanta(robi, a[i]);\n        if (d < min) {\n            min = d;\n            poz = i;\n        }\n    }\n    return poz;\n}\n\nint main() {\n    int n, i, k;\n    robot robi, a[21];\n    cin >> n;\n    cin >> robi.x >> robi.y;\n    for (i = 0; i < n; i++)\n        cin >> a[i].x >> a[i].y;\n    k = gaseste(robi, a, n);\n    cout << a[k].x << " " << a[k].y;\n    return 0;\n}`,
        type: "code"
    },
    1522: {
        text: "În urma executării programului de mai jos se afișează:",
        code: `#include <iostream>\nusing namespace std;\n\nvoid functie(int &a, int &b) {\n    b = 3 * b;\n    a = 2 * a;\n}\n\nint main() {\n    int n = 4;\n    functie(n, n);\n    cout << n;\n    return 0;\n}`,
        type: "code"
    },
    1598: {
        text: "Un arbore oarecare cu rădăcină este reprezentat prin vectorul de tați t. Dacă algoritmul următor determină nivelul pe care se găsește un nod x în arbore, cu ce secvență de cod se pot înlocui punctele de suspensie de mai jos?",
        code: `int nivel = 0;\nwhile (t[x]) {\n    ...\n    nivel++;\n}`,
        type: "code"
    }
};

module.exports = special29;
