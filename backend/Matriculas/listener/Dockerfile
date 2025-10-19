FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends tzdata openssh-client && rm -rf /var/lib/apt/lists/*
COPY listener/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt
COPY listener /app
EXPOSE 2221
ENV PORT=2221
CMD ["python", "app.py"]
