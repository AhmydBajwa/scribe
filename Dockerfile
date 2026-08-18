FROM node:22-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv ffmpeg && rm -rf /var/lib/apt/lists/*
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:${PATH}" PYTHON_EXECUTABLE=python3

WORKDIR /opt/scribel
COPY package*.json ./
RUN npm ci --omit=dev
COPY requirements.txt ./
RUN pip install --no-cache-dir --upgrade pip setuptools wheel
# Keep the CPU builds paired at an explicit compatible version. Splitting these
# layers makes Render logs identify the failing package instead of masking it.
RUN pip install --no-cache-dir torch==2.9.1 torchaudio==2.9.1 --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir -r requirements.txt
COPY . .

ENV NODE_ENV=production PORT=10000
EXPOSE 10000
CMD ["npm", "start"]
