FROM python:3.11-slim

WORKDIR /src
COPY . /src

# Install dependencies using CPU-only PyTorch to save 2.5GB of CUDA downloads and avoid connection drops!
RUN pip install --no-cache-dir torch==2.1.2 torchvision==0.16.2 --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir pillow==10.2.0 flask==3.0.0

EXPOSE 5000
CMD ["python", "serve.py"]
