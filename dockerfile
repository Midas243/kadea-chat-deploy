FROM node:lts-bookworm-slim AS base

# ----------------------------
# Stage 1: Install all dependencies
# ----------------------------
FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# ----------------------------
# Stage 2: Build the application
# ----------------------------
FROM deps AS build
WORKDIR /app
COPY . .
RUN node ace build

# ----------------------------
# Stage 3: Production runtime
# ----------------------------
FROM base AS production
WORKDIR /app

ARG TZ
ARG PORT
ARG HOST
ARG NODE_ENV

# App
ARG LOG_LEVEL
ARG APP_KEY
ARG APP_URL

# Session
ARG SESSION_DRIVER

# Database
ARG DB_HOST
ARG DB_PORT
ARG DB_USER
ARG DB_PASSWORD
ARG DB_DATABASE
ARG MAIL_MAILER
ARG MAIL_FROM_NAME
ARG MAIL_FROM_ADDRESS
ARG BREVO_API_KEY
ARG REQUIRE_EMAIL_VERIFICATION


# Node
ENV TZ=${TZ}
ENV PORT=${PORT}
ENV HOST=${HOST}
ENV NODE_ENV=${NODE_ENV}

# App
ENV LOG_LEVEL=${LOG_LEVEL}
ENV APP_KEY=${APP_KEY}
ENV APP_URL=${APP_URL}

# Session
ENV SESSION_DRIVER=${SESSION_DRIVER}

# Database
ENV DB_HOST=${DB_HOST}
ENV DB_PORT=${DB_PORT}
ENV DB_USER=${DB_USER}
ENV DB_PASSWORD=${DB_PASSWORD}
ENV DB_DATABASE=${DB_DATABASE}
ENV MAIL_MAILER=${MAIL_MAILER}
ENV MAIL_FROM_NAME=${MAIL_FROM_NAME}
ENV MAIL_FROM_ADDRESS=${MAIL_FROM_ADDRESS}
ENV BREVO_API_KEY=${BREVO_API_KEY}
ENV REQUIRE_EMAIL_VERIFICATION=${REQUIRE_EMAIL_VERIFICATION}


COPY --from=build /app/build ./
RUN npm ci --omit=dev

EXPOSE 3333
CMD ["node", "bin/server.js"]
