import PyPDF2
import sys

def extract_text(pdf_path, output_path):
    with open(pdf_path, 'rb') as file:
        reader = PyPDF2.PdfReader(file)
        text = ""
        for page in reader.pages:
            text += page.extract_text() + "\n"
            
    with open(output_path, 'w', encoding='utf-8') as out_file:
        out_file.write(text)

extract_text(r'C:\Users\Tudor\.gemini\antigravity\brain\4b96adcc-92c9-445e-97f6-662dc5907380\.user_uploaded\media_1789399749777.pdf', 'pdf_dump.txt')
print("PDF extracted successfully.")
