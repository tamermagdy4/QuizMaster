import json
import re

with open(r'D:\New folder\محمد صلاح.txt', 'r', encoding='utf-8') as f:
    lines = f.readlines()

questions = []
current_question = ''
current_answer = ''

for line in lines:
    line = line.strip()
    if not line:
        # flush pending question/answer pair
        if current_question and current_answer:
            questions.append({'q': current_question, 'a': current_answer})
            current_question = ''
            current_answer = ''
        continue
    
    # Skip section headers
    if '500 نقطة' in line or '🔥' in line:
        # flush pending
        if current_question and current_answer:
            questions.append({'q': current_question, 'a': current_answer})
            current_question = ''
            current_answer = ''
        continue
    
    # Format 1: "question — answer" on one line
    if ' — ' in line:
        parts = line.split(' — ', 1)
        q = parts[0].strip()
        a = parts[1].strip()
        questions.append({'q': q, 'a': a})
        current_question = ''
        current_answer = ''
    elif line.startswith('الإجابة:'):
        # Format 2: answer line
        answer = line.replace('الإجابة:', '', 1).strip()
        answer = answer.rstrip('.')
        if current_question:
            questions.append({'q': current_question, 'a': answer})
            current_question = ''
            current_answer = ''
    else:
        # This is a question line in two-line format
        current_question = line

# flush last
if current_question and current_answer:
    questions.append({'q': current_question, 'a': current_answer})

print(f'Total questions parsed: {len(questions)}')
for i, q in enumerate(questions):
    print(f'{i+1}. {q["q"]} | {q["a"]}')
