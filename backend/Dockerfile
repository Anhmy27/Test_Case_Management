# Playwright image includes Chromium for automation runs + Jira HTTP client deps
FROM mcr.microsoft.com/playwright:v1.55.0-noble

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .
RUN mkdir -p uploads

EXPOSE 5000

CMD ["node", "index.js"]
