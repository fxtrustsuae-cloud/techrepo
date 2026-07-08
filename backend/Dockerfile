FROM node:20-alpine

WORKDIR /app

# Install canvas dependencies
RUN apk add --no-cache \
    cairo-dev \
    pango-dev \
    libjpeg-turbo-dev \
    giflib-dev \
    librsvg-dev \
    pixman-dev \
    python3 \
    py3-setuptools \
    make \
    g++ \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

RUN mkdir -p reports charts logs

ENV CHROMIUM_PATH=/usr/bin/chromium-browser

EXPOSE 5000

CMD ["node", "server.js"]
