import nltk
import csv
from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize
from nltk.stem import PorterStemmer
import pandas as pd

# Download necessary data
nltk.download('punkt')
nltk.download('punkt_tab')
nltk.download('stopwords')

def remove_stopwords(text):
    stop_words = set(stopwords.words('english'))
    word_tokens = word_tokenize(text)
    filtered_text = [word for word in word_tokens if word.lower() not in stop_words]
    return " ".join(filtered_text)

def apply_stemming(text):
    ps = PorterStemmer()
    word_tokens = word_tokenize(text)
    stemmed_text = [ps.stem(word) for word in word_tokens]
    return " ".join(stemmed_text)

def preprocess_text(text):
    # 1. Lowercase
    text = text.lower()
    # 2. Tokenize
    word_tokens = word_tokenize(text)
    # 3. Remove Stop Words
    stop_words = set(stopwords.words('english'))
    filtered_text = [word for word in word_tokens if word not in stop_words]
    # 4. Stemming
    ps = PorterStemmer()
    stemmed_text = [ps.stem(word) for word in filtered_text]
    
    return " ".join(stemmed_text)


input_path = "C:\\Users\\elias\\Desktop\\CS 5124 Data Visualization\\Project 3 - TV Time\\The-Office-Lines-V4.csv"
output_path = "C:\\Users\\elias\\Desktop\\CS 5124 Data Visualization\\Project 3 - TV Time\\The-Office-Lines-V4-Processed.csv"

with open(input_path, newline="", encoding="utf-8") as infile, \
     open(output_path, "w", newline="", encoding="utf-8") as outfile:

    reader = csv.reader(infile)
    writer = csv.writer(outfile)

    for row in reader:
        # ensure the row has at least 7 columns
        row += [""] * (7 - len(row))

        col_f = row[5]   # column F is index 5
        row[6] = preprocess_text(col_f)  # column G is index 6

        writer.writerow(row)