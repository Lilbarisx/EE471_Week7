FROM python:3.11-slim

WORKDIR /src
COPY . /src

# Installs dependencies as specified in cog.yaml
RUN pip install --no-cache-dir torch==2.1.2 torchvision==0.16.2 pillow==10.2.0 flask==3.0.0

EXPOSE 5000
CMD ["python", "serve.py"]
