#!/bin/sh
cd /tmp
sed 's|./DB/matriculas.db|/app/DB/matriculas.db|g' insert_test.py > insert_container.py
python insert_container.py
