FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM python:3.12-slim
RUN useradd --create-home --uid 1000 app
WORKDIR /home/app/site
COPY --from=build --chown=app:app /app/dist/ ./
USER app
EXPOSE 7860
CMD ["python", "-m", "http.server", "7860", "--bind", "0.0.0.0"]
